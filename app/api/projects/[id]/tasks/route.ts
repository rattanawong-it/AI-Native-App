// app/api/projects/[id]/tasks/route.ts
// GET — การ์ดทั้งหมดบนกระดานของโครงการ พร้อมสรุปแต่ละคอลัมน์ (F5.4, F5.12, F5.13)
//
//   ?sprintId=<id>   เฉพาะงานในรอบพัฒนานั้น
//   ?sprintId=none   Backlog — งานที่ยังไม่เข้ารอบ (F5.13)
//   ไม่ระบุ          ทุกงานในโครงการ
//
// การ์ดถูกส่งมาเป็นรายการเดียวเรียงตาม sortOrder แล้วให้หน้าจอแยกลงคอลัมน์เอง —
// เพราะการลากย้ายต้องรู้ลำดับของทั้งคอลัมน์อยู่แล้ว การส่งแยกก้อนไม่ได้ช่วยอะไร

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { listTasksQuerySchema } from "@/lib/project-schema"
import {
    SDLC_ROLES,
    sprintSelect,
    summarizeBoard,
    taskCardSelect,
    toTaskCardDtos,
} from "@/lib/project-service"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    const { id } = await params

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
        projectId: id,
        ...sprintWhere,
        ...assigneeWhere,
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.q
            ? {
                  OR: [
                      { title: { contains: query.q, mode: "insensitive" } },
                      { description: { contains: query.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!project) return notFound("ไม่พบโครงการที่ต้องการ")

        const rows = await prisma.task.findMany({
            where,
            select: taskCardSelect,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })
        const tasks = await toTaskCardDtos(rows)

        // สรุปของ Sprint ที่กำลังดู — ใช้ทำแถบความคืบหน้าเหนือกระดาน (F5.12)
        let sprint = null
        if (query.sprintId && query.sprintId !== "none") {
            const found = await prisma.sprint.findUnique({
                where: { id: query.sprintId },
                select: sprintSelect,
            })
            if (found && found.projectId === id) {
                sprint = { ...found, summary: summarizeBoard(tasks) }
            }
        }

        return NextResponse.json({ tasks, summary: summarizeBoard(tasks), sprint })
    } catch (error) {
        console.error("Board GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดกระดานงานได้" }, { status: 500 })
    }
}
