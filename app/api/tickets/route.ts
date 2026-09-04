// app/api/tickets/route.ts
// GET  — รายการ Ticket พร้อมฟิลเตอร์ / ค้นหา / pagination (F1.3, F1.4, F1.11, F2.5)
// POST — สร้าง Ticket ใหม่ + gen ticketNo + คำนวณ priority + due date + auto-assign (F1.2, F2.7)
// ผ่าน NFR1 (ตรวจ session) · NFR2 (zod) · NFR3 (row-level scope)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, badRequest, isStaff } from "@/lib/rbac"
import { calculatePriority } from "@/lib/priority"
import { createWithRunningNumber, nextTicketNo } from "@/lib/running-number"
import {
    createTicketSchema,
    listTicketsQuerySchema,
    searchParamsToObject,
    firstIssueMessage,
} from "@/lib/ticket-schema"
import {
    buildTicketOrderBy,
    buildTicketWhere,
    computeDueDates,
    logActivity,
    resolveAutoAssign,
    sortByQueue,
    syncBreachFlags,
    ticketListSelect,
    withSla,
} from "@/lib/ticket-service"
import { notifyTicketCreated } from "@/lib/ticket-notify"

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listTicketsQuerySchema.safeParse(
        searchParamsToObject(new URL(request.url))
    )
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where = buildTicketWhere(query, user)

    try {
        const [total, rows] = await Promise.all([
            prisma.ticket.count({ where }),
            prisma.ticket.findMany({
                where,
                select: ticketListSelect,
                orderBy: buildTicketOrderBy(query.sort),
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
        ])

        // F4.7 — ตั้งธง breach ให้ตรงกับเวลาปัจจุบันก่อนคืนค่า
        await syncBreachFlags(rows)

        // F2.5 — คิวงานเรียงตาม Priority ก่อน แล้วค่อยดูกำหนดเวลา
        const ordered = query.sort === "queue" ? sortByQueue(rows) : rows

        return NextResponse.json({
            tickets: await withSla(ordered),
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("Ticket GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการ Ticket ได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createTicketSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    // F1.10 — แจ้งแทนผู้อื่นได้เฉพาะเจ้าหน้าที่ขึ้นไป
    let requesterId = user.id
    if (input.requesterId && input.requesterId !== user.id) {
        if (!isStaff(user)) {
            return badRequest("คุณไม่มีสิทธิ์แจ้งปัญหาแทนผู้อื่น")
        }
        const exists = await prisma.user.findUnique({
            where: { id: input.requesterId },
            select: { id: true },
        })
        if (!exists) return badRequest("ไม่พบผู้แจ้งที่ระบุ")
        requesterId = input.requesterId
    }

    // ช่องทางอื่นนอกจากเว็บ ใช้ได้เฉพาะเจ้าหน้าที่ที่บันทึกแทน (F1.10)
    const channel = input.channel !== "web" && !isStaff(user) ? "web" : input.channel

    const category = await prisma.serviceCategory.findFirst({
        where: { id: input.categoryId, active: true },
        select: { id: true },
    })
    if (!category) return badRequest("ไม่พบหมวดหมู่บริการที่เลือก")

    try {
        const now = new Date()
        const priority = calculatePriority(input.impact, input.urgency)
        const { responseDueAt, resolutionDueAt } = await computeDueDates(
            priority,
            input.categoryId,
            now
        )
        const auto = await resolveAutoAssign(input.categoryId)

        // หน่วยงานต้นสังกัดของผู้แจ้ง ใช้เป็นค่าเริ่มต้นถ้าไม่ได้ระบุมา
        const requester = await prisma.user.findUnique({
            where: { id: requesterId },
            select: { departmentId: true },
        })

        const ticket = await createWithRunningNumber(
            () => nextTicketNo(now),
            (ticketNo) =>
                prisma.ticket.create({
                    data: {
                        ticketNo,
                        title: input.title,
                        description: input.description,
                        categoryId: input.categoryId,
                        requesterId,
                        departmentId: input.departmentId ?? requester?.departmentId ?? null,
                        channel,
                        impact: input.impact,
                        urgency: input.urgency,
                        priority,
                        // F2.7 — มอบหมายอัตโนมัติแล้วให้สถานะข้ามไป assigned ทันที
                        status: auto.assigneeId ? "assigned" : "new",
                        assigneeId: auto.assigneeId,
                        teamId: auto.teamId,
                        responseDueAt,
                        resolutionDueAt,
                    },
                    select: ticketListSelect,
                })
        )

        await logActivity(prisma, {
            ticketId: ticket.id,
            actorId: user.id,
            action: "created",
            toValue: ticket.ticketNo,
            note: requesterId !== user.id ? "บันทึกแทนผู้แจ้ง" : null,
        })

        if (auto.assigneeId) {
            await logActivity(prisma, {
                ticketId: ticket.id,
                actorId: user.id,
                action: "assigned",
                toValue: auto.assigneeId,
                // เหตุผลที่เลือกคนนี้มาจาก resolveAutoAssign เพื่อให้ตรวจย้อนหลังได้ (F2.11)
                note: auto.reason ?? "มอบหมายอัตโนมัติตามหมวดหมู่บริการ",
            })
        }

        // F8.6 — แจ้งเจ้าหน้าที่ที่รับงานและประกาศเข้ากลุ่ม LINE
        // ยิงแล้วไม่รอ: การส่งเมล/LINE ใช้เวลาเป็นวินาที ผู้แจ้งไม่ควรต้องรอหน้าจอค้าง
        void notifyTicketCreated(ticket, user.id)

        return NextResponse.json({ ticket }, { status: 201 })
    } catch (error) {
        console.error("Ticket POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึก Ticket ได้" }, { status: 500 })
    }
}
