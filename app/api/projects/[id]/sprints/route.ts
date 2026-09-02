// app/api/projects/[id]/sprints/route.ts
// GET  — Sprint ทั้งหมดของโครงการ พร้อมสรุปจำนวนงานแต่ละคอลัมน์ (F5.3, F5.12)
// POST — สร้าง Sprint ใหม่ (F5.3)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { createSprintSchema } from "@/lib/project-schema"
import { SORT_STEP } from "@/lib/task-board"
import {
    SDLC_ROLES,
    canManageProject,
    decimalOrNull,
    sprintSelect,
    summarizeBoard,
} from "@/lib/project-service"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!project) return notFound("ไม่พบโครงการที่ต้องการ")

        const [sprints, tasks] = await Promise.all([
            prisma.sprint.findMany({
                where: { projectId: id },
                select: sprintSelect,
                orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }],
            }),
            prisma.task.findMany({
                where: { projectId: id, sprintId: { not: null } },
                select: { sprintId: true, boardStatus: true, estimateHours: true },
            }),
        ])

        // สรุปทีละ Sprint จากชุดข้อมูลก้อนเดียว — ไม่ยิงคิวรีต่อ Sprint
        const withSummary = sprints.map((s) => ({
            ...s,
            summary: summarizeBoard(
                tasks
                    .filter((t) => t.sprintId === s.id)
                    .map((t) => ({
                        boardStatus: t.boardStatus,
                        estimateHours: decimalOrNull(t.estimateHours),
                    }))
            ),
        }))

        return NextResponse.json({ sprints: withSummary })
    } catch (error) {
        console.error("Sprint GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการ Sprint ได้" }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("สร้าง Sprint ได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createSprintSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!project) return notFound("ไม่พบโครงการที่ต้องการ")

        // มี Sprint ที่กำลังเดินอยู่ได้ทีละรอบเดียว — กันงานถูกกระจายข้ามรอบจนติดตามไม่ได้
        if (input.status === "active") {
            const running = await prisma.sprint.findFirst({
                where: { projectId: id, status: "active" },
                select: { name: true },
            })
            if (running) {
                return badRequest(
                    `โครงการนี้มี Sprint "${running.name}" กำลังดำเนินการอยู่ กรุณาปิดรอบก่อนเปิดรอบใหม่`
                )
            }
        }

        const last = await prisma.sprint.findFirst({
            where: { projectId: id },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        })

        const sprint = await prisma.sprint.create({
            data: {
                projectId: id,
                name: input.name,
                goal: input.goal ?? null,
                startDate: input.startDate,
                endDate: input.endDate,
                status: input.status,
                sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
            },
            select: sprintSelect,
        })

        return NextResponse.json({ sprint }, { status: 201 })
    } catch (error) {
        console.error("Sprint POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถสร้าง Sprint ได้" }, { status: 500 })
    }
}
