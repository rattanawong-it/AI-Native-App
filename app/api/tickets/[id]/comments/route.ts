// app/api/tickets/[id]/comments/route.ts
// GET  — ความคิดเห็นทั้งหมดของ Ticket (บันทึกภายในซ่อนจากผู้แจ้ง)
// POST — เพิ่มความคิดเห็น + toggle "บันทึกภายใน" (F1.6)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
    requireAuth,
    badRequest,
    notFound,
    forbidden,
    canAccessTicket,
    isStaff,
} from "@/lib/rbac"
import { createCommentSchema, firstIssueMessage } from "@/lib/ticket-schema"
import { logActivity } from "@/lib/ticket-service"

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
            select: { requesterId: true, assigneeId: true },
        })
        if (!ticket) return notFound("ไม่พบ Ticket ที่ต้องการ")
        if (!canAccessTicket(user, ticket)) return forbidden("คุณไม่มีสิทธิ์ดู Ticket ใบนี้")

        const comments = await prisma.ticketComment.findMany({
            // F1.6 — ผู้แจ้งไม่เห็นบันทึกภายใน
            where: isStaff(user) ? { ticketId: id } : { ticketId: id, isInternal: false },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                body: true,
                isInternal: true,
                createdAt: true,
                author: { select: personSelect },
            },
        })

        return NextResponse.json({ comments })
    } catch (error) {
        console.error("Ticket comments GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดความคิดเห็นได้" }, { status: 500 })
    }
}

export async function POST(
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

    const parsed = createCommentSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            select: {
                requesterId: true,
                assigneeId: true,
                status: true,
                respondedAt: true,
                responseDueAt: true,
            },
        })
        if (!ticket) return notFound("ไม่พบ Ticket ที่ต้องการ")
        if (!canAccessTicket(user, ticket)) return forbidden("คุณไม่มีสิทธิ์ดู Ticket ใบนี้")
        if (ticket.status === "closed") {
            return badRequest("Ticket ปิดงานแล้ว ไม่สามารถแสดงความคิดเห็นเพิ่มได้")
        }

        const staff = isStaff(user)
        // บันทึกภายในใช้ได้เฉพาะเจ้าหน้าที่ — ผู้แจ้งจะถูกบังคับเป็นความคิดเห็นปกติ
        const isInternal = staff ? input.isInternal : false

        const now = new Date()
        const comment = await prisma.$transaction(async (tx) => {
            const created = await tx.ticketComment.create({
                data: {
                    ticketId: id,
                    authorId: user.id,
                    body: input.body,
                    isInternal,
                },
                select: {
                    id: true,
                    body: true,
                    isInternal: true,
                    createdAt: true,
                    author: { select: personSelect },
                },
            })

            // F4.6 — เจ้าหน้าที่ตอบกลับครั้งแรก (ไม่ใช่บันทึกภายใน) นับเป็นเวลาตอบกลับ
            if (staff && !isInternal && !ticket.respondedAt) {
                await tx.ticket.update({
                    where: { id },
                    data: {
                        respondedAt: now,
                        responseBreached: Boolean(
                            ticket.responseDueAt && ticket.responseDueAt < now
                        ),
                    },
                })
            }

            await logActivity(tx, {
                ticketId: id,
                actorId: user.id,
                action: "commented",
                note: isInternal ? "บันทึกภายใน" : null,
            })

            return created
        })

        return NextResponse.json({ comment }, { status: 201 })
    } catch (error) {
        console.error("Ticket comments POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกความคิดเห็นได้" }, { status: 500 })
    }
}
