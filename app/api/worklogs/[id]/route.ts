// app/api/worklogs/[id]/route.ts
// PATCH  — แก้ไขบันทึกเวลาทำงาน (F3.5)
// DELETE — ลบบันทึกเวลาทำงาน
//
// เจ้าของบันทึกเท่านั้นที่แก้/ลบได้ — หัวหน้า "ดู" ของทีมได้ (F3.8) แต่ไม่แก้แทน
// เพราะบันทึกเวลาเป็นคำให้การของเจ้าตัวเรื่องภาระงาน

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden, STAFF_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateWorkLogSchema } from "@/lib/worklog-schema"
import { toWorkLogDto, validateWorkLogRef, workLogSelect } from "@/lib/worklog-service"
import { utcDate } from "@/lib/sla-service"

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

    const parsed = updateWorkLogSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.workLog.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                refType: true,
                ticketId: true,
                taskId: true,
                todoId: true,
            },
        })
        if (!current) return notFound("ไม่พบบันทึกเวลาที่ต้องการ")
        if (current.userId !== user.id) return forbidden("แก้ไขได้เฉพาะบันทึกเวลาของตัวเอง")

        // ส่งมาแก้ทีละฟิลด์ได้ จึงต้องรวมกับค่าเดิมก่อนตรวจว่าคู่ refType/id ยังถูกต้อง
        const refType = input.refType ?? current.refType
        const ticketId = input.ticketId !== undefined ? (input.ticketId ?? null) : current.ticketId
        const taskId = input.taskId !== undefined ? (input.taskId ?? null) : current.taskId
        const todoId = input.todoId !== undefined ? (input.todoId ?? null) : current.todoId

        const ref = { refType, ticketId, taskId, todoId }
        if (
            (refType === "ticket" && !ticketId) ||
            (refType === "task" && !taskId) ||
            (refType === "todo" && !todoId)
        ) {
            return badRequest("กรุณาเลือกงานที่ต้องการผูกกับบันทึกเวลานี้")
        }

        const refError = await validateWorkLogRef(user, ref)
        if (refError) return badRequest(refError)

        const data: Prisma.WorkLogUpdateInput = {}
        if (input.workDate !== undefined) data.workDate = utcDate(input.workDate)
        if (input.hours !== undefined) data.hours = input.hours
        if (input.description !== undefined) data.description = input.description

        // เปลี่ยนประเภทงานเมื่อไร ต้องล้าง id ของประเภทเดิมทิ้งพร้อมกันเสมอ
        if (
            input.refType !== undefined ||
            input.ticketId !== undefined ||
            input.taskId !== undefined ||
            input.todoId !== undefined
        ) {
            data.refType = refType
            data.ticket =
                refType === "ticket" && ticketId
                    ? { connect: { id: ticketId } }
                    : { disconnect: true }
            data.task =
                refType === "task" && taskId ? { connect: { id: taskId } } : { disconnect: true }
            data.todo =
                refType === "todo" && todoId ? { connect: { id: todoId } } : { disconnect: true }
        }

        const row = await prisma.workLog.update({ where: { id }, data, select: workLogSelect })
        return NextResponse.json({ workLog: toWorkLogDto(row) })
    } catch (error) {
        console.error("WorkLog PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแก้ไขบันทึกเวลาได้" }, { status: 500 })
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
        const current = await prisma.workLog.findUnique({
            where: { id },
            select: { id: true, userId: true },
        })
        if (!current) return notFound("ไม่พบบันทึกเวลาที่ต้องการ")
        if (current.userId !== user.id) return forbidden("ลบได้เฉพาะบันทึกเวลาของตัวเอง")

        await prisma.workLog.delete({ where: { id } })
        return NextResponse.json({ deleted: true })
    } catch (error) {
        console.error("WorkLog DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบบันทึกเวลาได้" }, { status: 500 })
    }
}
