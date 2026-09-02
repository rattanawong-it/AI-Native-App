// app/api/teams/route.ts
// GET  — รายชื่อทีมงานพร้อมสมาชิก (F5.11)
// POST — สร้างทีมใหม่ (F5.11)
//
// สิทธิ์ตาม spec §7 — เจ้าหน้าที่อ่านได้ · สร้าง/แก้เฉพาะหัวหน้าขึ้นไป
// ทีมชุดนี้คือทีมเดียวกับที่ Ticket และ ServiceCategory อ้างถึง ไม่ใช่ตารางแยก

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { createTeamSchema, listTeamsQuerySchema } from "@/lib/project-schema"
import {
    SDLC_ROLES,
    canManageProject,
    teamSelect,
    validateAssignee,
} from "@/lib/project-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response

    const parsed = listTeamsQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where: Prisma.TeamWhereInput = {
        ...(query.state === "all" ? {} : { active: query.state === "active" }),
        ...(query.q
            ? {
                  OR: [
                      { name: { contains: query.q, mode: "insensitive" } },
                      { description: { contains: query.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    }

    try {
        const teams = await prisma.team.findMany({
            where,
            select: teamSelect,
            orderBy: [{ active: "desc" }, { name: "asc" }],
        })
        return NextResponse.json({ teams })
    } catch (error) {
        console.error("Team GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อทีมได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("สร้างทีมได้เฉพาะหัวหน้างานขึ้นไป")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createTeamSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const duplicate = await prisma.team.findFirst({
            where: { name: input.name },
            select: { id: true },
        })
        if (duplicate) return badRequest(`มีทีมชื่อ "${input.name}" อยู่แล้ว`)

        if (input.leaderId) {
            const leaderError = await validateAssignee(input.leaderId)
            if (leaderError) return badRequest("ไม่พบผู้ใช้ที่เลือกเป็นหัวหน้าทีม")
        }

        const team = await prisma.team.create({
            data: {
                name: input.name,
                description: input.description ?? null,
                leaderId: input.leaderId ?? null,
                active: input.active,
                // หัวหน้าทีมเป็นสมาชิกของทีมโดยอัตโนมัติ — ไม่งั้นทีมใหม่จะไม่มีสมาชิกเลย
                ...(input.leaderId
                    ? { members: { create: { userId: input.leaderId, roleInTeam: "leader" } } }
                    : {}),
            },
            select: teamSelect,
        })

        return NextResponse.json({ team }, { status: 201 })
    } catch (error) {
        console.error("Team POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถสร้างทีมได้" }, { status: 500 })
    }
}
