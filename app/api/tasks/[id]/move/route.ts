// app/api/tasks/[id]/move/route.ts
// PATCH — ลากการ์ดข้ามคอลัมน์ / สลับลำดับ / โยนเข้า-ออก Sprint (F5.5, F5.13)
//
// แยกจาก PATCH /api/tasks/[id] เพราะเป็นคนละเจตนา: การลากเกิดบ่อยมากและต้องเบา
// ที่สุด ส่งมาแค่ปลายทางกับการ์ดที่จะแทรกก่อนหน้า แล้วเซิร์ฟเวอร์คิดเลขลำดับให้เอง
//
// สิทธิ์ตาม spec §7 — หัวหน้าขึ้นไปลากได้ทุกใบ · เจ้าหน้าที่ลากได้เฉพาะงานที่ตัวเองถือ

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { moveTaskSchema } from "@/lib/project-schema"
import {
    SDLC_ROLES,
    canUpdateTask,
    loggedHoursOf,
    recalcProjectProgress,
    sortOrderForMove,
    taskCardSelect,
    toTaskCardDto,
    validateSprintOfProject,
} from "@/lib/project-service"

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

    const parsed = moveTaskSchema.safeParse(body)
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
            },
        })
        if (!current) return notFound("ไม่พบงานที่ต้องการย้าย")
        if (!canUpdateTask(user, current)) {
            return forbidden("ย้ายได้เฉพาะงานที่คุณรับผิดชอบ")
        }

        // ไม่ส่ง sprintId มา = ลากภายในกระดานเดิม จึงคงรอบพัฒนาไว้ตามเดิม
        const targetSprintId =
            input.sprintId !== undefined ? (input.sprintId ?? null) : current.sprintId

        if (targetSprintId !== current.sprintId) {
            const sprintError = await validateSprintOfProject(current.projectId, targetSprintId)
            if (sprintError) return badRequest(sprintError)
        }

        const sortOrder = await sortOrderForMove(
            id,
            {
                projectId: current.projectId,
                boardStatus: input.boardStatus,
                sprintId: targetSprintId,
            },
            input.beforeTaskId ?? null
        )

        const task = await prisma.task.update({
            where: { id },
            data: {
                boardStatus: input.boardStatus,
                sprintId: targetSprintId,
                sortOrder,
            },
            select: taskCardSelect,
        })

        // เข้า/ออกคอลัมน์ done เท่านั้นที่ทำให้ตัวเลขความคืบหน้าเปลี่ยน (F5.10)
        let progress: number | null = null
        if (input.boardStatus !== current.boardStatus) {
            progress = await recalcProjectProgress(current.projectId)
        }

        return NextResponse.json({ task: toTaskCardDto(task, await loggedHoursOf(id)), progress })
    } catch (error) {
        console.error("Task move Error:", error)
        return NextResponse.json({ error: "ไม่สามารถย้ายงานได้" }, { status: 500 })
    }
}
