// app/api/teams/[id]/members/[userId]/route.ts
// PATCH  — เปลี่ยนบทบาทของสมาชิกในทีม (F5.11)
// DELETE — ถอดสมาชิกออกจากทีม

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { addTeamMemberSchema } from "@/lib/project-schema"
import { SDLC_ROLES, canManageProject, teamSelect } from "@/lib/project-service"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("จัดการสมาชิกทีมได้เฉพาะหัวหน้างานขึ้นไป")
    const { id, userId } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    // ใช้ schema เดียวกับตอนเพิ่ม แต่สนใจเฉพาะบทบาท — userId มาจาก path แล้ว
    const parsed = addTeamMemberSchema.pick({ roleInTeam: true }).safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const roleInTeam = parsed.data.roleInTeam

    try {
        const member = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId: id, userId } },
            select: { id: true },
        })
        if (!member) return notFound("ไม่พบสมาชิกรายนี้ในทีม")

        await prisma.teamMember.update({
            where: { teamId_userId: { teamId: id, userId } },
            data: { roleInTeam },
        })

        if (roleInTeam === "leader") {
            await prisma.team.update({ where: { id }, data: { leaderId: userId } })
            await prisma.teamMember.updateMany({
                where: { teamId: id, userId: { not: userId }, roleInTeam: "leader" },
                data: { roleInTeam: "member" },
            })
        } else {
            // ลดหัวหน้าลงเป็นสมาชิก — ทีมนั้นจะไม่มีหัวหน้าจนกว่าจะตั้งคนใหม่
            await prisma.team.updateMany({
                where: { id, leaderId: userId },
                data: { leaderId: null },
            })
        }

        const team = await prisma.team.findUnique({ where: { id }, select: teamSelect })
        return NextResponse.json({ team })
    } catch (error) {
        console.error("Team member PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถเปลี่ยนบทบาทสมาชิกได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("จัดการสมาชิกทีมได้เฉพาะหัวหน้างานขึ้นไป")
    const { id, userId } = await params

    try {
        const member = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId: id, userId } },
            select: { id: true },
        })
        if (!member) return notFound("ไม่พบสมาชิกรายนี้ในทีม")

        await prisma.teamMember.delete({
            where: { teamId_userId: { teamId: id, userId } },
        })

        // ถอดคนที่เป็นหัวหน้าออก = ทีมไม่มีหัวหน้าแล้ว ต้องล้างค่าไว้ให้ตรงกัน
        await prisma.team.updateMany({
            where: { id, leaderId: userId },
            data: { leaderId: null },
        })

        const team = await prisma.team.findUnique({ where: { id }, select: teamSelect })
        return NextResponse.json({ team })
    } catch (error) {
        console.error("Team member DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถถอดสมาชิกออกจากทีมได้" }, { status: 500 })
    }
}
