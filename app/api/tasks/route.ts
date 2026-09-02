// app/api/tasks/route.ts
// GET  — ค้นหางานข้ามโครงการ (ใช้ในหน้า My Work และช่องเลือกงานของ Time Log)
// POST — สร้างงานใหม่บนกระดาน (F5.6)
//
// สิทธิ์ตาม spec §7 — เจ้าหน้าที่อ่านได้ทั้งหมด · สร้างงานใหม่เฉพาะหัวหน้าขึ้นไป

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { createTaskSchema, listTasksQuerySchema } from "@/lib/project-schema"
import { notifyTaskAssigned } from "@/lib/task-notify"
import {
    SDLC_ROLES,
    canManageProject,
    nextSortOrder,
    recalcProjectProgress,
    taskCardSelect,
    toTaskCardDto,
    validateAssignee,
    validateSprintOfProject,
} from "@/lib/project-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listTasksQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const sprintWhere: Prisma.TaskWhereInput =
        query.sprintId === undefined
            ? {}
            : query.sprintId === "none"
              ? { sprintId: null }
              : { sprintId: query.sprintId }

    const assigneeWhere: Prisma.TaskWhereInput =
        query.assigneeId === undefined
            ? {}
            : query.assigneeId === "unassigned"
              ? { assigneeId: null }
              : { assigneeId: query.assigneeId === "me" ? user.id : query.assigneeId }

    const where: Prisma.TaskWhereInput = {
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...sprintWhere,
        ...assigneeWhere,
        ...(query.boardStatus ? { boardStatus: query.boardStatus } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
    }

    try {
        const [rows, total] = await Promise.all([
            prisma.task.findMany({
                where,
                select: taskCardSelect,
                orderBy: [{ updatedAt: "desc" }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            prisma.task.count({ where }),
        ])

        return NextResponse.json({
            tasks: rows.map(toTaskCardDto),
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("Task GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการงานได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("สร้างงานบนกระดานได้เฉพาะหัวหน้างานขึ้นไป")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const project = await prisma.project.findUnique({
            where: { id: input.projectId },
            select: { id: true, name: true },
        })
        if (!project) return badRequest("ไม่พบโครงการที่เลือก")

        const sprintError = await validateSprintOfProject(input.projectId, input.sprintId)
        if (sprintError) return badRequest(sprintError)

        const assigneeError = await validateAssignee(input.assigneeId)
        if (assigneeError) return badRequest(assigneeError)

        const sortOrder = await nextSortOrder({
            projectId: input.projectId,
            boardStatus: input.boardStatus,
            sprintId: input.sprintId ?? null,
        })

        const task = await prisma.task.create({
            data: {
                projectId: input.projectId,
                sprintId: input.sprintId ?? null,
                title: input.title,
                description: input.description ?? null,
                boardStatus: input.boardStatus,
                priority: input.priority,
                assigneeId: input.assigneeId ?? null,
                estimateHours: input.estimateHours ?? null,
                dueDate: input.dueDate ?? null,
                sortOrder,
                createdBy: user.id,
            },
            select: taskCardSelect,
        })

        await recalcProjectProgress(input.projectId)

        // ยิงแล้วไม่รอ — การส่งอีเมล/LINE ใช้เวลาเป็นวินาที ผู้ใช้ไม่ควรรอหน้าจอค้าง
        if (task.assigneeId) {
            const sprintName = input.sprintId
                ? ((
                      await prisma.sprint.findUnique({
                          where: { id: input.sprintId },
                          select: { name: true },
                      })
                  )?.name ?? null)
                : null

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
                    projectName: project.name,
                    sprintName,
                }
            )
        }

        return NextResponse.json({ task: toTaskCardDto(task) }, { status: 201 })
    } catch (error) {
        console.error("Task POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถสร้างงานได้" }, { status: 500 })
    }
}
