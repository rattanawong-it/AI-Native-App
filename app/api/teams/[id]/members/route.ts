// app/api/teams/[id]/members/route.ts
// POST — เพิ่มสมาชิกเข้าทีม (F5.11)
//
// การถอดสมาชิก/เปลี่ยนบทบาทอยู่ที่ [userId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { addTeamMemberSchema } from "@/lib/project-schema"
import {
    SDLC_ROLES,
    canManageProject,
    teamSelect,
    validateAssignee,
} from "@/lib/project-service"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("จัดการสมาชิกทีมได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = addTeamMemberSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const team = await prisma.team.findUnique({ where: { id }, select: { id: true } })
        if (!team) return notFound("ไม่พบทีมที่ต้องการ")

        const userError = await validateAssignee(input.userId)
        if (userError) return badRequest("ไม่พบผู้ใช้ที่เลือก")

        const existing = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId: id, userId: input.userId } },
            select: { id: true },
        })
        if (existing) return badRequest("ผู้ใช้รายนี้อยู่ในทีมนี้อยู่แล้ว")

        await prisma.teamMember.create({
            data: { teamId: id, userId: input.userId, roleInTeam: input.roleInTeam },
        })

        // ตั้งเป็นหัวหน้า = ต้องอัปเดตหัวหน้าของทีมให้ตรงกันด้วย ไม่งั้นสองที่จะขัดกัน
        if (input.roleInTeam === "leader") {
            await prisma.team.update({ where: { id }, data: { leaderId: input.userId } })
            await prisma.teamMember.updateMany({
                where: { teamId: id, userId: { not: input.userId }, roleInTeam: "leader" },
                data: { roleInTeam: "member" },
            })
        }

        const updated = await prisma.team.findUnique({ where: { id }, select: teamSelect })
        return NextResponse.json({ team: updated }, { status: 201 })
    } catch (error) {
        console.error("Team member POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถเพิ่มสมาชิกได้" }, { status: 500 })
    }
}
