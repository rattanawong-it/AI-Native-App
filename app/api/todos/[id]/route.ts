// app/api/todos/[id]/route.ts
// PATCH  — แก้ไขงานส่วนตัว + ติ๊กเสร็จ/ยกเลิกติ๊ก (F3.3, F3.4)
// DELETE — ลบงานส่วนตัว
//
// เจ้าของเท่านั้นที่แตะได้ — ตรวจ `ownerId` ทุกครั้งก่อนแก้ (NFR3)
// งานที่มี Time Log ผูกอยู่จะลบไม่ได้ เพราะ FK ของ WorkLog.todoId ไม่ได้ตั้ง cascade
// (ตั้งใจ — บันทึกเวลาเป็นหลักฐานภาระงาน ไม่ควรหายไปพร้อมการลบงาน)

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden, STAFF_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateTodoSchema } from "@/lib/worklog-schema"
import { todoSelect } from "@/lib/worklog-service"

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

    const parsed = updateTodoSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.todoItem.findUnique({
            where: { id },
            select: { id: true, ownerId: true, isDone: true },
        })
        if (!current) return notFound("ไม่พบงานส่วนตัวที่ต้องการ")
        if (current.ownerId !== user.id) return forbidden("แก้ไขได้เฉพาะงานส่วนตัวของตัวเอง")

        const data: Prisma.TodoItemUpdateInput = {}
        if (input.title !== undefined) data.title = input.title
        if (input.note !== undefined) data.note = input.note ?? null
        if (input.dueDate !== undefined) data.dueDate = input.dueDate ?? null
        if (input.priority !== undefined) data.priority = input.priority

        // ติ๊กเสร็จ/ยกเลิกติ๊ก — บันทึก doneAt ให้ตรงกับสถานะเสมอ (F3.4)
        if (input.isDone !== undefined && input.isDone !== current.isDone) {
            data.isDone = input.isDone
            data.doneAt = input.isDone ? new Date() : null
        }

        if (Object.keys(data).length === 0) {
            return badRequest("ไม่มีข้อมูลที่ต้องการแก้ไข")
        }

        const todo = await prisma.todoItem.update({ where: { id }, data, select: todoSelect })
        return NextResponse.json({ todo })
    } catch (error) {
        console.error("Todo PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแก้ไขงานส่วนตัวได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    const { id } = await params

    try {
        const current = await prisma.todoItem.findUnique({
            where: { id },
            select: { id: true, ownerId: true, _count: { select: { workLogs: true } } },
        })
        if (!current) return notFound("ไม่พบงานส่วนตัวที่ต้องการ")
        if (current.ownerId !== user.id) return forbidden("ลบได้เฉพาะงานส่วนตัวของตัวเอง")

        if (current._count.workLogs > 0) {
            return badRequest(
                `งานนี้มีบันทึกเวลาผูกอยู่ ${current._count.workLogs} รายการ กรุณาลบบันทึกเวลาก่อน`
            )
        }

        await prisma.todoItem.delete({ where: { id } })
        return NextResponse.json({ deleted: true })
    } catch (error) {
        console.error("Todo DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบงานส่วนตัวได้" }, { status: 500 })
    }
}
