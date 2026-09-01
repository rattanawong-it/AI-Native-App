// app/api/tickets/[id]/route.ts
// GET   — รายละเอียด Ticket + timeline + comment (F1.5)
// PATCH — แก้ไขรายละเอียด / ปรับ Impact × Urgency แล้วคำนวณ priority + due date ใหม่ (F2.4)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
    requireAuth,
    badRequest,
    notFound,
    forbidden,
    canAccessTicket,
    canUpdateTicket,
    isStaff,
} from "@/lib/rbac"
import { PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { updateTicketSchema, firstIssueMessage } from "@/lib/ticket-schema"
import {
    computeTicketSla,
    logActivity,
    recalculate,
    ticketDetailSelect,
} from "@/lib/ticket-service"

const personSelect = { id: true, name: true, email: true, image: true } as const

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard
    const { id } = await params

    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            select: ticketDetailSelect,
        })
        if (!ticket) return notFound("ไม่พบ Ticket ที่ต้องการ")

        // NFR3 — ผู้ที่ไม่ใช่เจ้าหน้าที่เปิดดูได้เฉพาะใบที่ตัวเองแจ้ง (F1.4)
        if (!canAccessTicket(user, ticket)) return forbidden("คุณไม่มีสิทธิ์ดู Ticket ใบนี้")

        const staff = isStaff(user)

        const [comments, activities] = await Promise.all([
            prisma.ticketComment.findMany({
                // F1.6 — บันทึกภายในซ่อนจากผู้แจ้ง
                where: staff ? { ticketId: id } : { ticketId: id, isInternal: false },
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    body: true,
                    isInternal: true,
                    createdAt: true,
                    author: { select: personSelect },
                },
            }),
            prisma.ticketActivity.findMany({
                where: { ticketId: id },
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    action: true,
                    fromValue: true,
                    toValue: true,
                    note: true,
                    createdAt: true,
                    actor: { select: personSelect },
                },
            }),
        ])

        return NextResponse.json({
            ticket: { ...ticket, sla: await computeTicketSla(ticket) },
            comments,
            activities,
            can: {
                update: canUpdateTicket(user, ticket),
                comment: true,
                internalNote: staff,
            },
        })
    } catch (error) {
        console.error("Ticket detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูล Ticket ได้" }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateTicketSchema.safeParse(body)
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
                categoryId: true,
                impact: true,
                urgency: true,
                priority: true,
                createdAt: true,
            },
        })
        if (!current) return notFound("ไม่พบ Ticket ที่ต้องการ")
        if (current.status === "closed") {
            return badRequest("Ticket ปิดงานแล้ว ไม่สามารถแก้ไขได้")
        }

        const staff = isStaff(user)
        const owner = current.requesterId === user.id

        // ผู้แจ้งแก้ได้เฉพาะหัวข้อ/รายละเอียด และเฉพาะตอนที่ยังไม่มีใครเริ่มงาน
        const changingPriorityInputs =
            input.impact !== undefined || input.urgency !== undefined
        if (changingPriorityInputs && !canUpdateTicket(user, current)) {
            return forbidden("คุณไม่มีสิทธิ์ปรับระดับความสำคัญของ Ticket ใบนี้")
        }
        if (!staff) {
            if (!owner) return forbidden("คุณไม่มีสิทธิ์แก้ไข Ticket ใบนี้")
            if (current.status !== "new") {
                return badRequest("เจ้าหน้าที่รับงานแล้ว กรุณาแจ้งเพิ่มเติมผ่านความคิดเห็นแทน")
            }
        }

        const impact = input.impact ?? current.impact
        const urgency = input.urgency ?? current.urgency
        const categoryId = input.categoryId ?? current.categoryId

        if (input.categoryId && input.categoryId !== current.categoryId) {
            const category = await prisma.serviceCategory.findFirst({
                where: { id: input.categoryId, active: true },
                select: { id: true },
            })
            if (!category) return badRequest("ไม่พบหมวดหมู่บริการที่เลือก")
        }

        const priorityChanged =
            impact !== current.impact ||
            urgency !== current.urgency ||
            categoryId !== current.categoryId

        // F2.4 — Impact/Urgency เปลี่ยน → priority + กำหนดเวลาคำนวณใหม่จากเวลาที่แจ้ง
        const recalculated = priorityChanged
            ? await recalculate(impact, urgency, categoryId, current.createdAt)
            : null

        const ticket = await prisma.ticket.update({
            where: { id },
            data: {
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
                ...(input.departmentId !== undefined
                    ? { departmentId: input.departmentId ?? null }
                    : {}),
                ...(input.impact !== undefined ? { impact: input.impact } : {}),
                ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
                ...(recalculated
                    ? {
                          priority: recalculated.priority,
                          responseDueAt: recalculated.responseDueAt,
                          resolutionDueAt: recalculated.resolutionDueAt,
                          // กำหนดเวลาใหม่แล้วต้องประเมินธง breach ใหม่ด้วย
                          responseBreached: false,
                          resolutionBreached: false,
                      }
                    : {}),
            },
            select: ticketDetailSelect,
        })

        // F2.4 — บันทึกเหตุผลการปรับลง TicketActivity
        if (recalculated && recalculated.priority !== current.priority) {
            await logActivity(prisma, {
                ticketId: id,
                actorId: user.id,
                action: "priority_changed",
                fromValue: PRIORITY_LABEL[current.priority as Priority] ?? current.priority,
                toValue: PRIORITY_LABEL[recalculated.priority],
                note: input.reason ?? null,
            })
        }

        return NextResponse.json({ ticket: { ...ticket, sla: await computeTicketSla(ticket) } })
    } catch (error) {
        console.error("Ticket PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแก้ไข Ticket ได้" }, { status: 500 })
    }
}
