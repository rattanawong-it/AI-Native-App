// app/api/tasks/[id]/comments/route.ts
// GET  — ความเห็นทั้งหมดของงาน (F5.7)
// POST — เพิ่มความเห็นใหม่
//
// ต่างจากความเห็นใน Ticket ตรงที่ไม่มี "บันทึกภายใน" — กระดานพัฒนาเห็นกันทั้งทีมอยู่แล้ว

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { createTaskCommentSchema } from "@/lib/project-schema"
import { SDLC_ROLES, taskCommentSelect } from "@/lib/project-service"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const comments = await prisma.taskComment.findMany({
            where: { taskId: id },
            select: taskCommentSelect,
            orderBy: { createdAt: "asc" },
        })
        return NextResponse.json({ comments })
    } catch (error) {
        console.error("Task comment GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดความคิดเห็นได้" }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createTaskCommentSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    try {
        const task = await prisma.task.findUnique({ where: { id }, select: { id: true } })
        if (!task) return notFound("ไม่พบงานที่ต้องการ")

        const comment = await prisma.taskComment.create({
            data: { taskId: id, authorId: user.id, body: parsed.data.body },
            select: taskCommentSelect,
        })

        return NextResponse.json({ comment }, { status: 201 })
    } catch (error) {
        console.error("Task comment POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกความคิดเห็นได้" }, { status: 500 })
    }
}
