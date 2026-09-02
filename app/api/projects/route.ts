// app/api/projects/route.ts
// GET  — รายการโครงการ + ค้นหา/กรอง/แบ่งหน้า (F5.1)
// POST — สร้างโครงการใหม่ (F5.1)
//
// สิทธิ์ตาม spec §7 — เจ้าหน้าที่ขึ้นไปอ่านได้ทั้งหมด แต่สร้าง/แก้ได้เฉพาะหัวหน้าขึ้นไป

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { createProjectSchema, listProjectsQuerySchema } from "@/lib/project-schema"
import { OPEN_PROJECT_STATUSES, PROJECT_STATUSES } from "@/lib/task-board"
import {
    SDLC_ROLES,
    canManageProject,
    projectListSelect,
    type ProjectListRow,
} from "@/lib/project-service"

/// เติมจำนวน Task ที่ปิดงานแล้วให้แต่ละโครงการ — ยิงคิวรีเดียวแล้วจับคู่ ไม่ยิงต่อโครงการ
async function withDoneCounts(projects: ProjectListRow[]) {
    if (projects.length === 0) return []

    const grouped = await prisma.task.groupBy({
        by: ["projectId"],
        where: { projectId: { in: projects.map((p) => p.id) }, boardStatus: "done" },
        _count: { _all: true },
    })
    const doneMap = new Map(grouped.map((g) => [g.projectId, g._count._all]))

    return projects.map((p) => ({ ...p, doneTasks: doneMap.get(p.id) ?? 0 }))
}

export async function GET(request: NextRequest) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response

    const parsed = listProjectsQuerySchema.safeParse(
        searchParamsToObject(new URL(request.url))
    )
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const statusWhere: Prisma.ProjectWhereInput =
        query.status === "all"
            ? {}
            : query.status === "open"
              ? { status: { in: OPEN_PROJECT_STATUSES } }
              : { status: query.status }

    const where: Prisma.ProjectWhereInput = {
        ...statusWhere,
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
        ...(query.q
            ? {
                  OR: [
                      { code: { contains: query.q, mode: "insensitive" } },
                      { name: { contains: query.q, mode: "insensitive" } },
                      { description: { contains: query.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    }

    try {
        const [rows, total, grouped] = await Promise.all([
            prisma.project.findMany({
                where,
                select: projectListSelect,
                // โครงการที่ยังเดินอยู่ควรอยู่บนสุด แล้วค่อยเรียงตามการเคลื่อนไหวล่าสุด
                orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            prisma.project.count({ where }),
            prisma.project.groupBy({ by: ["status"], _count: { _all: true } }),
        ])

        const statusCounts: Record<string, number> = Object.fromEntries(
            PROJECT_STATUSES.map((s) => [s, 0])
        )
        for (const g of grouped) statusCounts[g.status] = g._count._all

        return NextResponse.json({
            projects: await withDoneCounts(rows),
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
            statusCounts,
        })
    } catch (error) {
        console.error("Project GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการโครงการได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("สร้างโครงการได้เฉพาะหัวหน้างานขึ้นไป")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const duplicate = await prisma.project.findUnique({
            where: { code: input.code },
            select: { id: true },
        })
        if (duplicate) return badRequest(`รหัสโครงการ "${input.code}" ถูกใช้ไปแล้ว`)

        const project = await prisma.project.create({
            data: {
                code: input.code,
                name: input.name,
                description: input.description ?? null,
                status: input.status,
                // ไม่ระบุเจ้าของ = คนที่กดสร้างเป็นเจ้าของโครงการ
                ownerId: input.ownerId ?? user.id,
                teamId: input.teamId ?? null,
                startDate: input.startDate ?? null,
                endDate: input.endDate ?? null,
            },
            select: projectListSelect,
        })

        return NextResponse.json({ project: { ...project, doneTasks: 0 } }, { status: 201 })
    } catch (error) {
        console.error("Project POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถสร้างโครงการได้" }, { status: 500 })
    }
}
