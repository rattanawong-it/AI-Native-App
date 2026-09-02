// app/api/teams/[id]/route.ts
// GET    — รายละเอียดทีม + สมาชิก (F5.11)
// PATCH  — แก้ไขทีม / เปลี่ยนหัวหน้า / ปิดใช้งาน
// DELETE — ลบทีม (ทำได้เฉพาะทีมที่ยังไม่ถูกอ้างถึงจากที่อื่น)

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateTeamSchema } from "@/lib/project-schema"
import {
    SDLC_ROLES,
    canManageProject,
    teamSelect,
    validateAssignee,
} from "@/lib/project-service"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const team = await prisma.team.findUnique({ where: { id }, select: teamSelect })
        if (!team) return notFound("ไม่พบทีมที่ต้องการ")
        return NextResponse.json({ team })
    } catch (error) {
        console.error("Team detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลทีมได้" }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("แก้ไขทีมได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateTeamSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.team.findUnique({
            where: { id },
            select: { id: true, name: true, leaderId: true },
        })
        if (!current) return notFound("ไม่พบทีมที่ต้องการ")

        if (input.name && input.name !== current.name) {
            const duplicate = await prisma.team.findFirst({
                where: { name: input.name, id: { not: id } },
                select: { id: true },
            })
            if (duplicate) return badRequest(`มีทีมชื่อ "${input.name}" อยู่แล้ว`)
        }

        if (input.leaderId) {
            const leaderError = await validateAssignee(input.leaderId)
            if (leaderError) return badRequest("ไม่พบผู้ใช้ที่เลือกเป็นหัวหน้าทีม")
        }

        const data: Prisma.TeamUpdateInput = {}
        if (input.name !== undefined) data.name = input.name
        if (input.description !== undefined) data.description = input.description ?? null
        if (input.active !== undefined) data.active = input.active
        if (input.leaderId !== undefined) {
            data.leader = input.leaderId ? { connect: { id: input.leaderId } } : { disconnect: true }
        }

        await prisma.team.update({ where: { id }, data })

        // หัวหน้าคนใหม่ต้องอยู่ในทีมด้วยเสมอ และคนเก่าลดบทบาทลงเป็นสมาชิก
        // (ไม่ถอดออกจากทีม — เขายังทำงานอยู่ แค่ไม่ได้เป็นหัวหน้าแล้ว)
        if (input.leaderId !== undefined && input.leaderId !== current.leaderId) {
            if (current.leaderId) {
                await prisma.teamMember.updateMany({
                    where: { teamId: id, userId: current.leaderId },
                    data: { roleInTeam: "member" },
                })
            }
            if (input.leaderId) {
                await prisma.teamMember.upsert({
                    where: { teamId_userId: { teamId: id, userId: input.leaderId } },
                    create: { teamId: id, userId: input.leaderId, roleInTeam: "leader" },
                    update: { roleInTeam: "leader" },
                })
            }
        }

        const team = await prisma.team.findUnique({ where: { id }, select: teamSelect })
        return NextResponse.json({ team })
    } catch (error) {
        console.error("Team PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไขทีมได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("ลบทีมได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    try {
        const team = await prisma.team.findUnique({
            where: { id },
            select: {
                id: true,
                _count: { select: { projects: true, tickets: true, categories: true } },
            },
        })
        if (!team) return notFound("ไม่พบทีมที่ต้องการ")

        // ทีมถูกอ้างถึงจาก Ticket / โครงการ / หมวดหมู่บริการ — ลบแล้วประวัติจะขาด
        // จึงให้ปิดใช้งานแทน (active = false) ซึ่งซ่อนออกจาก dropdown ทุกที่อยู่แล้ว
        const used = team._count.projects + team._count.tickets + team._count.categories
        if (used > 0) {
            return badRequest(
                `ลบไม่ได้ — ทีมนี้ถูกอ้างถึงอยู่ ${used} รายการ (โครงการ/Ticket/หมวดหมู่บริการ) กรุณาปิดใช้งานแทน`
            )
        }

        await prisma.team.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Team DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบทีมได้" }, { status: 500 })
    }
}
