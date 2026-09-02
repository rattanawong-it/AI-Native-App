// app/api/todos/route.ts
// GET  — รายการงานส่วนตัวของผู้ใช้ที่ล็อกอิน (F3.3)
// POST — เพิ่มงานส่วนตัวใหม่ (F3.3)
//
// งานส่วนตัวเป็นของใครของมัน — ทุก query ผูก `ownerId = me` เสมอ ไม่มี role ไหนเห็นของคนอื่น
// (NFR3) แม้แต่ admin เพราะเป็นบันทึกส่วนตัว ไม่ใช่ข้อมูลของหน่วยงาน
// สิทธิ์เข้าถึงตาม spec §7 — My Work เปิดให้ agent ขึ้นไป

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { createTodoSchema, listTodosQuerySchema } from "@/lib/worklog-schema"
import { todoSelect } from "@/lib/worklog-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listTodosQuerySchema.safeParse(
        searchParamsToObject(new URL(request.url))
    )
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where: Prisma.TodoItemWhereInput = {
        ownerId: user.id,
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

        return NextResponse.json({
            todos,
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
    const guard = await requireRole(["agent", "manager", "admin"])
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
