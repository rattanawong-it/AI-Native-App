// app/api/tickets/[id]/assign/route.ts
// PATCH — มอบหมาย / โยกย้ายงาน + บันทึก activity log (F2.7, F2.8)
//
// สิทธิ์ตาม spec §7:
//   manager / admin — โยกย้ายได้ทุกใบ
//   agent           — รับงานที่ยังไม่มีเจ้าของ หรือโยกใบที่ตัวเองถืออยู่

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
    requireRole,
    badRequest,
    notFound,
    forbidden,
    canAssignTicket,
    isManager,
    STAFF_ROLES,
} from "@/lib/rbac"
import { assignTicketSchema, firstIssueMessage } from "@/lib/ticket-schema"
import { logActivity, ticketDetailSelect, computeTicketSla } from "@/lib/ticket-service"
import { notifyTicketAssigned } from "@/lib/ticket-notify"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = assignTicketSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.ticket.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                requesterId: true,
                assigneeId: true,
                teamId: true,
                assignee: { select: { name: true } },
            },
        })
        if (!current) return notFound("ไม่พบ Ticket ที่ต้องการ")
        if (current.status === "closed") return badRequest("Ticket ปิดงานแล้ว ไม่สามารถโยกย้ายได้")

        // agent รับงานที่ยังว่างได้เอง — นอกเหนือจากนั้นต้องเป็นเจ้าของงานหรือหัวหน้า
        const claimingFreeTicket = current.assigneeId === null && input.assigneeId === user.id
        if (!claimingFreeTicket && !canAssignTicket(user, current)) {
            return forbidden("คุณไม่มีสิทธิ์มอบหมายงานใบนี้")
        }
        // ยกงานให้คนอื่นเป็นอำนาจของหัวหน้า (spec §7 — agent มอบหมายได้เฉพาะของตัวเอง)
        if (input.assigneeId && input.assigneeId !== user.id && !isManager(user)) {
            return forbidden("เฉพาะหัวหน้าเท่านั้นที่มอบหมายงานให้ผู้อื่นได้")
        }

        let assigneeName = "ไม่ระบุ"
        if (input.assigneeId) {
            const assignee = await prisma.user.findUnique({
                where: { id: input.assigneeId },
                select: { id: true, name: true, role: true },
            })
            if (!assignee) return badRequest("ไม่พบเจ้าหน้าที่ที่เลือก")
            // ผู้รับงานต้องเป็นเจ้าหน้าที่ขึ้นไป
            const roles = (assignee.role || "user").split(",").map((r) => r.trim())
            if (!roles.some((r) => ["agent", "manager", "admin"].includes(r))) {
                return badRequest("ผู้รับงานต้องมีสิทธิ์ระดับเจ้าหน้าที่ขึ้นไป")
            }
            assigneeName = assignee.name
        }

        if (input.teamId) {
            const team = await prisma.team.findFirst({
                where: { id: input.teamId, active: true },
                select: { id: true },
            })
            if (!team) return badRequest("ไม่พบทีมที่เลือก")
        }

        const ticket = await prisma.$transaction(async (tx) => {
            const updated = await tx.ticket.update({
                where: { id },
                data: {
                    assigneeId: input.assigneeId,
                    ...(input.teamId !== undefined ? { teamId: input.teamId ?? null } : {}),
                    // F2.6 — มอบหมายแล้วสถานะขยับจาก new เป็น assigned อัตโนมัติ
                    ...(input.assigneeId && current.status === "new"
                        ? { status: "assigned" }
                        : {}),
                    // ถอนการมอบหมายจากงานที่ยังไม่เริ่ม → กลับเป็น new
                    ...(!input.assigneeId && current.status === "assigned"
                        ? { status: "new" }
                        : {}),
                },
                select: ticketDetailSelect,
            })

            await logActivity(tx, {
                ticketId: id,
                actorId: user.id,
                action: "assigned",
                fromValue: current.assignee?.name ?? null,
                toValue: input.assigneeId ? assigneeName : null,
                note: input.note ?? (input.assigneeId ? null : "ถอนการมอบหมาย"),
            })

            return updated
        })

        // F8.6 — แจ้งผู้รับงานคนใหม่ (ยิงแล้วไม่รอ ดูหมายเหตุใน lib/ticket-notify.ts)
        void notifyTicketAssigned(ticket, user.id, user.name)

        return NextResponse.json({ ticket: { ...ticket, sla: await computeTicketSla(ticket) } })
    } catch (error) {
        console.error("Ticket assign PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถมอบหมายงานได้" }, { status: 500 })
    }
}
