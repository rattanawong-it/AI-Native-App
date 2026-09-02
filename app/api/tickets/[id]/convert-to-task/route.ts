// app/api/tickets/[id]/convert-to-task/route.ts
// POST — แปลง Ticket เป็นงานพัฒนาใน Backlog ของโครงการ (F5.8, F5.9)
//
// เก็บลิงก์ไว้สองทางเสมอ:
//   Task.sourceTicketId  → Ticket ต้นทาง  ("มาจาก Ticket #...")
//   Ticket.convertedTaskId → Task ปลายทาง ("งานพัฒนาที่เกี่ยวข้อง")
// เขียนทั้งคู่ในทรานแซกชันเดียว ไม่งั้นลิงก์จะขาดข้างเดียวเมื่อมีอะไรพลาดกลางทาง
//
// Ticket ใบหนึ่งแปลงได้ครั้งเดียว — `Ticket.convertedTaskId` เป็น @unique อยู่แล้ว
// และการแปลงซ้ำจะทำให้ทีมพัฒนามีการ์ดซ้ำโดยไม่มีใครรู้ว่าใบไหนคือใบจริง

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { convertTicketSchema } from "@/lib/project-schema"
import { logActivity } from "@/lib/ticket-service"
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

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) {
        return forbidden("แปลง Ticket เป็นงานพัฒนาได้เฉพาะหัวหน้างานขึ้นไป")
    }
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = convertTicketSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            select: {
                id: true,
                ticketNo: true,
                title: true,
                description: true,
                priority: true,
                assigneeId: true,
                resolutionDueAt: true,
                convertedTaskId: true,
            },
        })
        if (!ticket) return notFound("ไม่พบ Ticket ที่ต้องการแปลง")
        if (ticket.convertedTaskId) {
            return badRequest("Ticket ใบนี้ถูกแปลงเป็นงานพัฒนาไปแล้ว")
        }

        const project = await prisma.project.findUnique({
            where: { id: input.projectId },
            select: { id: true, name: true },
        })
        if (!project) return badRequest("ไม่พบโครงการที่เลือก")

        const sprintError = await validateSprintOfProject(input.projectId, input.sprintId)
        if (sprintError) return badRequest(sprintError)

        // ไม่ระบุผู้รับผิดชอบ = ใช้คนที่ถือ Ticket ใบนี้อยู่ (เขารู้เรื่องดีที่สุด)
        const assigneeId = input.assigneeId !== undefined ? input.assigneeId : ticket.assigneeId
        const assigneeError = await validateAssignee(assigneeId)
        if (assigneeError) return badRequest(assigneeError)

        // งานที่แปลงมาเข้า Backlog เสมอ — ให้ทีมพัฒนาเป็นคนจัดคิวเองว่ารอบไหนทำ
        const sortOrder = await nextSortOrder({
            projectId: input.projectId,
            boardStatus: "backlog",
            sprintId: input.sprintId ?? null,
        })

        const task = await prisma.$transaction(async (tx) => {
            const created = await tx.task.create({
                data: {
                    projectId: input.projectId,
                    sprintId: input.sprintId ?? null,
                    title: input.title ?? ticket.title,
                    // ยกรายละเอียดของ Ticket มาเป็นตั้งต้น พร้อมอ้างเลขที่ใบไว้ในเนื้อความ
                    description: [
                        `มาจาก Ticket ${ticket.ticketNo}`,
                        "",
                        ticket.description,
                    ].join("\n"),
                    boardStatus: "backlog",
                    priority: input.priority ?? ticket.priority,
                    assigneeId: assigneeId ?? null,
                    estimateHours: input.estimateHours ?? null,
                    dueDate: input.dueDate ?? ticket.resolutionDueAt,
                    sortOrder,
                    sourceTicketId: ticket.id,
                    createdBy: user.id,
                },
                select: taskCardSelect,
            })

            await tx.ticket.update({
                where: { id: ticket.id },
                data: { convertedTaskId: created.id },
            })

            await logActivity(tx, {
                ticketId: ticket.id,
                actorId: user.id,
                action: "converted_to_task",
                toValue: project.name,
                note: `แปลงเป็นงานพัฒนาในโครงการ ${project.name}`,
            })

            return created
        })

        await recalcProjectProgress(input.projectId)

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
        console.error("Ticket convert Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแปลง Ticket เป็นงานพัฒนาได้" }, { status: 500 })
    }
}
