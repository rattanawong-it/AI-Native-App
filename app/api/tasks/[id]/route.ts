// app/api/tasks/[id]/route.ts
// GET    — รายละเอียดงาน + ความเห็นทั้งหมด (F5.7)
// PATCH  — แก้ไขงาน / เปลี่ยนผู้รับผิดชอบ / ย้ายรอบพัฒนา (F5.6)
// DELETE — ลบงาน
//
// สิทธิ์ตาม spec §7 — หัวหน้าขึ้นไปแก้ได้ทุกใบ · เจ้าหน้าที่แก้ได้เฉพาะงานที่ตัวเองถือ

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateTaskSchema } from "@/lib/project-schema"
import type { BoardStatus } from "@/lib/task-board"
import { notifyTaskAssigned } from "@/lib/task-notify"
import {
    SDLC_ROLES,
    canManageProject,
    canUpdateTask,
    loggedHoursOf,
    nextSortOrder,
    recalcProjectProgress,
    taskCommentSelect,
    taskDetailSelect,
    toTaskDetailDto,
    validateAssignee,
    validateSprintOfProject,
} from "@/lib/project-service"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const task = await prisma.task.findUnique({ where: { id }, select: taskDetailSelect })
        if (!task) return notFound("ไม่พบงานที่ต้องการ")

        const [comments, loggedHours] = await Promise.all([
            prisma.taskComment.findMany({
                where: { taskId: id },
                select: taskCommentSelect,
                orderBy: { createdAt: "asc" },
            }),
            loggedHoursOf(id),
        ])

        return NextResponse.json({ task: toTaskDetailDto(task, loggedHours), comments })
    } catch (error) {
        console.error("Task detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายละเอียดงานได้" }, { status: 500 })
    }
}

export async function PATCH(
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

    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.task.findUnique({
            where: { id },
            select: {
                id: true,
                projectId: true,
                sprintId: true,
                boardStatus: true,
                assigneeId: true,
                project: { select: { name: true } },
            },
        })
        if (!current) return notFound("ไม่พบงานที่ต้องการ")
        if (!canUpdateTask(user, current)) {
            return forbidden("แก้ไขได้เฉพาะงานที่คุณรับผิดชอบ")
        }

        // เปลี่ยนผู้รับผิดชอบเป็นการ "มอบหมายงาน" — สงวนไว้ให้หัวหน้าเหมือนฝั่ง Ticket (spec §7)
        if (
            input.assigneeId !== undefined &&
            (input.assigneeId ?? null) !== current.assigneeId &&
            !canManageProject(user)
        ) {
            return forbidden("มอบหมายงานให้ผู้อื่นได้เฉพาะหัวหน้างานขึ้นไป")
        }

        if (input.sprintId !== undefined) {
            const sprintError = await validateSprintOfProject(current.projectId, input.sprintId)
            if (sprintError) return badRequest(sprintError)
        }

        if (input.assigneeId) {
            const assigneeError = await validateAssignee(input.assigneeId)
            if (assigneeError) return badRequest(assigneeError)
        }

        const data: Prisma.TaskUpdateInput = {}
        if (input.title !== undefined) data.title = input.title
        if (input.description !== undefined) data.description = input.description ?? null
        if (input.boardStatus !== undefined) data.boardStatus = input.boardStatus
        if (input.priority !== undefined) data.priority = input.priority
        if (input.estimateHours !== undefined) data.estimateHours = input.estimateHours ?? null
        if (input.dueDate !== undefined) data.dueDate = input.dueDate ?? null
        if (input.assigneeId !== undefined) {
            data.assignee = input.assigneeId
                ? { connect: { id: input.assigneeId } }
                : { disconnect: true }
        }
        if (input.sprintId !== undefined) {
            data.sprint = input.sprintId
                ? { connect: { id: input.sprintId } }
                : { disconnect: true }
        }

        // ย้ายคอลัมน์หรือย้ายรอบผ่านฟอร์ม (ไม่ได้ลาก) — ต้องต่อท้ายคอลัมน์ปลายทาง
        // ไม่งั้นการ์ดจะไปแทรกกลางกองด้วยเลขลำดับเดิมของคอลัมน์เก่า
        const nextStatus = input.boardStatus ?? (current.boardStatus as BoardStatus)
        const nextSprint =
            input.sprintId !== undefined ? (input.sprintId ?? null) : current.sprintId
        if (nextStatus !== current.boardStatus || nextSprint !== current.sprintId) {
            data.sortOrder = await nextSortOrder({
                projectId: current.projectId,
                boardStatus: nextStatus,
                sprintId: nextSprint,
            })
        }

        const task = await prisma.task.update({
            where: { id },
            data,
            select: taskDetailSelect,
        })

        if (input.boardStatus !== undefined && input.boardStatus !== current.boardStatus) {
            await recalcProjectProgress(current.projectId)
        }

        if (task.assigneeId && task.assigneeId !== current.assigneeId) {
            void notifyTaskAssigned(
                {
                    id: task.id,
                    title: task.title,
                    projectId: task.projectId,
                    priority: task.priority,
                    dueDate: task.dueDate,
                    assigneeId: task.assigneeId,
                },
                {
                    actorId: user.id,
                    actorName: user.name,
                    projectName: current.project.name,
                    sprintName: task.sprint?.name ?? null,
                }
            )
        }

        return NextResponse.json({ task: toTaskDetailDto(task, await loggedHoursOf(id)) })
    } catch (error) {
        console.error("Task PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไขงานได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("ลบงานได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    try {
        const task = await prisma.task.findUnique({
            where: { id },
            select: { id: true, projectId: true, _count: { select: { workLogs: true } } },
        })
        if (!task) return notFound("ไม่พบงานที่ต้องการ")

        // บันทึกเวลาเป็นหลักฐานภาระงาน — ลบงานทิ้งไม่ได้ถ้ามีคนลงเวลาไว้แล้ว
        if (task._count.workLogs > 0) {
            return badRequest(
                `ลบไม่ได้ — มีบันทึกเวลาทำงาน ${task._count.workLogs} รายการผูกอยู่กับงานนี้`
            )
        }

        // คลายลิงก์ฝั่ง Ticket ก่อน ไม่งั้น FK `Ticket.convertedTaskId` ค้าง (F5.8)
        await prisma.ticket.updateMany({
            where: { convertedTaskId: id },
            data: { convertedTaskId: null },
        })

        await prisma.task.delete({ where: { id } })
        await recalcProjectProgress(task.projectId)

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Task DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบงานได้" }, { status: 500 })
    }
}
