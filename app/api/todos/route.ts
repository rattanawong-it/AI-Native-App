// app/api/todos/route.ts
// GET  — รายการงานส่วนตัวของผู้ใช้ที่ล็อกอิน (F3.3)
// POST — เพิ่มงานส่วนตัวใหม่ (F3.3)
//
// งานส่วนตัวเป็นของใครของมัน — เพิ่ม/แก้/ลบได้เฉพาะเจ้าของ (NFR3)
// ยกเว้นการ "อ่าน": admin ส่ง `?ownerId=` เพื่อตรวจสอบ My Work ของผู้อื่นได้ (spec §20)
// สิทธิ์เข้าถึงตาม spec §7 — My Work เปิดให้ agent ขึ้นไป

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, isAdmin, STAFF_ROLES } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { createTodoSchema, listTodosQuerySchema } from "@/lib/worklog-schema"
import { todoSelect } from "@/lib/worklog-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listTodosQuerySchema.safeParse(
        searchParamsToObject(new URL(request.url))
    )
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    if (query.ownerId && query.ownerId !== user.id && !isAdmin(user)) {
        return forbidden("ดูงานส่วนตัวของผู้อื่นได้เฉพาะผู้ดูแลระบบ")
    }
    const ownerId = query.ownerId ?? user.id

    const where: Prisma.TodoItemWhereInput = {
        ownerId,
        ...(query.state === "all" ? {} : { isDone: query.state === "done" }),
        ...(query.q
            ? {
                  OR: [
                      { title: { contains: query.q, mode: "insensitive" } },
                      { note: { contains: query.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    }

    try {
        const [todos, total] = await Promise.all([
            prisma.todoItem.findMany({
                where,
                select: todoSelect,
                // ยังไม่เสร็จก่อน → ใกล้ครบกำหนดก่อน (null ไปท้าย) → เพิ่งสร้างก่อน
                orderBy: [
                    { isDone: "asc" },
                    { dueDate: { sort: "asc", nulls: "last" } },
                    { createdAt: "desc" },
                ],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            prisma.todoItem.count({ where }),
        ])

        // นาทีรวมต่องาน — งานส่วนตัวผูกเวลาได้เฉพาะเจ้าของ (validateWorkLogRef) จึงไม่ต้องกรอง userId ซ้ำ
        const minutes = await prisma.workLog.groupBy({
            by: ["todoId"],
            where: { todoId: { in: todos.map((t) => t.id) } },
            _sum: { minutes: true },
        })
        const minutesOf = new Map(minutes.map((m) => [m.todoId, m._sum.minutes ?? 0]))

        return NextResponse.json({
            todos: todos.map((t) => ({ ...t, loggedMinutes: minutesOf.get(t.id) ?? 0 })),
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("Todo GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการงานส่วนตัวได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createTodoSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const todo = await prisma.todoItem.create({
            data: {
                ownerId: user.id,
                title: input.title,
                note: input.note ?? null,
                dueDate: input.dueDate ?? null,
                priority: input.priority,
            },
            select: todoSelect,
        })

        return NextResponse.json({ todo }, { status: 201 })
    } catch (error) {
        console.error("Todo POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกงานส่วนตัวได้" }, { status: 500 })
    }
}
