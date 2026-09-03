// app/api/tickets/[id]/status/route.ts
// PATCH — เปลี่ยนสถานะตาม Workflow 5 สถานะ พร้อม validation (F2.6)
//
//   new → assigned → in_progress → resolved → closed
//
// ผลข้างเคียงที่บันทึกอัตโนมัติ:
//   - เข้า in_progress ครั้งแรก  → ตั้ง respondedAt + ประเมินธง responseBreached (F4.6, F4.7)
//   - เข้า resolved             → ตั้ง resolvedAt + resolutionNote + ธง resolutionBreached
//   - เข้า closed               → ตั้ง closedAt
//   - กลับจาก resolved          → ล้าง resolvedAt (เปิดงานอีกครั้ง)
//
// F3.6 — เข้าสถานะ resolved ต้องมีบันทึกเวลาทำงาน ถ้า AppSetting
//        `ticket.require_worklog_on_resolve` เปิดอยู่ (ค่าเริ่มต้น = เปิด)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
    requireRole,
    badRequest,
    notFound,
    forbidden,
    canUpdateTicket,
    isManager,
    STAFF_ROLES,
} from "@/lib/rbac"
import { changeStatusSchema, firstIssueMessage } from "@/lib/ticket-schema"
import {
    TICKET_STATUS_LABEL,
    transitionError,
    type TicketStatus,
    type TicketAction,
} from "@/lib/ticket-workflow"
import {
    logActivity,
    ticketDetailSelect,
    computeTicketSla,
    getAppSetting,
} from "@/lib/ticket-service"
import { notifyTicketStatusChanged } from "@/lib/ticket-notify"

/// เลือกชนิด activity ให้ตรงกับสถานะปลายทาง เพื่อให้ timeline อ่านง่าย
function actionOf(from: TicketStatus, to: TicketStatus): TicketAction {
    if (to === "resolved") return "resolved"
    if (to === "closed") return "closed"
    if (from === "resolved" && to === "in_progress") return "reopened"
    return "status_changed"
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // F2.6 — เปลี่ยนสถานะได้เฉพาะ agent ขึ้นไป (spec §7)
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

    const parsed = changeStatusSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.ticket.findUnique({
            where: { id },
            select: {
                id: true,
                ticketNo: true,
                status: true,
                requesterId: true,
                assigneeId: true,
                respondedAt: true,
                responseDueAt: true,
                resolutionDueAt: true,
            },
        })
        if (!current) return notFound("ไม่พบ Ticket ที่ต้องการ")

        if (!canUpdateTicket(user, current)) {
            return forbidden("Ticket ใบนี้อยู่ในความรับผิดชอบของเจ้าหน้าที่ท่านอื่น")
        }

        // F2.6 — ตรวจว่าเปลี่ยนสถานะนี้ได้จริงไหม
        const invalid = transitionError(current.status, input.status)
        if (invalid) return badRequest(invalid)

        // ต้องมีผู้รับผิดชอบก่อนจึงจะเข้าสถานะ assigned ได้
        if (input.status === "assigned" && !current.assigneeId) {
            return badRequest("กรุณามอบหมายเจ้าหน้าที่ก่อนเปลี่ยนเป็นสถานะ \"มอบหมายแล้ว\"")
        }

        // ปิดงานเป็นอำนาจของหัวหน้าขึ้นไป หรือผู้ที่ถือ Ticket ใบนั้นเอง
        if (input.status === "closed" && !isManager(user) && current.assigneeId !== user.id) {
            return forbidden("เฉพาะผู้รับผิดชอบหรือหัวหน้าเท่านั้นที่ปิดงานได้")
        }

        // F3.6 — บังคับบันทึก Time Log ก่อนเข้าสถานะ "แก้ไขเสร็จ" ถ้าเปิดกฎนี้ไว้
        //
        // นับรวมบันทึกเวลาที่เคยลงไว้กับใบนี้แล้วด้วย (เจ้าหน้าที่บางคนลงเวลาระหว่างทำงาน
        // ไม่ได้รอลงตอนปิด) จึงไม่บังคับให้กรอกซ้ำ
        if (input.status === "resolved" && !(input.workHours && input.workHours > 0)) {
            const required = await getAppSetting<boolean>(
                "ticket.require_worklog_on_resolve",
                true
            )
            if (required) {
                const logged = await prisma.workLog.count({ where: { ticketId: id } })
                if (logged === 0) {
                    return badRequest(
                        "ระบบกำหนดให้บันทึกชั่วโมงที่ใช้ทำงานก่อนปิดงาน กรุณากรอกจำนวนชั่วโมง"
                    )
                }
            }
        }

        const now = new Date()
        const from = current.status as TicketStatus
        const to = input.status

        const data: Record<string, unknown> = { status: to }

        // F4.6 — เวลาตอบกลับครั้งแรกของเจ้าหน้าที่
        if (to === "in_progress" && !current.respondedAt) {
            data.respondedAt = now
            data.responseBreached = Boolean(current.responseDueAt && current.responseDueAt < now)
        }

        if (to === "resolved") {
            data.resolvedAt = now
            data.resolutionNote = input.resolutionNote
            data.resolutionBreached = Boolean(
                current.resolutionDueAt && current.resolutionDueAt < now
            )
        }

        // เปิดงานอีกครั้ง — ล้างเวลาแก้ไขเสร็จเพื่อให้ SLA เดินต่อ
        if (from === "resolved" && to !== "closed") {
            data.resolvedAt = null
        }

        if (to === "closed") data.closedAt = now
        if (to === "new") {
            data.assigneeId = null
            data.teamId = null
        }

        const ticket = await prisma.$transaction(async (tx) => {
            const updated = await tx.ticket.update({
                where: { id },
                data,
                select: ticketDetailSelect,
            })

            await logActivity(tx, {
                ticketId: id,
                actorId: user.id,
                action: actionOf(from, to),
                fromValue: TICKET_STATUS_LABEL[from],
                toValue: TICKET_STATUS_LABEL[to],
                note: input.note ?? (to === "resolved" ? input.resolutionNote : null) ?? null,
            })

            // บันทึกชั่วโมงทำงานถ้ากรอกมาพร้อมการปิดงาน (F2.6 — เชื่อมกับ Time Log ใน F3.5)
            if (to === "resolved" && input.workHours && input.workHours > 0) {
                await tx.workLog.create({
                    data: {
                        userId: user.id,
                        workDate: new Date(now.toISOString().slice(0, 10)),
                        hours: input.workHours,
                        description: input.resolutionNote ?? `แก้ไข ${current.ticketNo}`,
                        refType: "ticket",
                        ticketId: id,
                    },
                })
            }

            return updated
        })

        // F8.6 — แจ้งผู้แจ้งและผู้รับผิดชอบว่าสถานะขยับ (ยิงแล้วไม่รอ)
        void notifyTicketStatusChanged(ticket, {
            fromLabel: TICKET_STATUS_LABEL[from],
            toLabel: TICKET_STATUS_LABEL[to],
            actorId: user.id,
            actorName: user.name,
            // ส่ง resolutionNote มาเฉพาะตอนปิดงาน เพื่อให้ใช้ข้อความแบบ "แก้ไขเสร็จ"
            resolutionNote: to === "resolved" ? (input.resolutionNote ?? null) : null,
        })

        return NextResponse.json({ ticket: { ...ticket, sla: await computeTicketSla(ticket) } })
    } catch (error) {
        console.error("Ticket status PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถเปลี่ยนสถานะได้" }, { status: 500 })
    }
}
