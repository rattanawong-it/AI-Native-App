// app/api/projects/[id]/sprints/[sprintId]/route.ts
// PATCH  — แก้ไข Sprint / เปิดรอบ / ปิดรอบ (F5.3)
// DELETE — ลบ Sprint (งานที่อยู่ข้างในถูกโยนกลับ Backlog ไม่ถูกลบตาม)

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateSprintSchema } from "@/lib/project-schema"
import { SDLC_ROLES, canManageProject, sprintSelect } from "@/lib/project-service"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("แก้ไข Sprint ได้เฉพาะหัวหน้างานขึ้นไป")
    const { id, sprintId } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateSprintSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.sprint.findUnique({
            where: { id: sprintId },
            select: { id: true, projectId: true, startDate: true, endDate: true, status: true },
        })
        if (!current || current.projectId !== id) return notFound("ไม่พบ Sprint ที่ต้องการ")

        const startDate = input.startDate ?? current.startDate
        const endDate = input.endDate ?? current.endDate
        if (startDate > endDate) return badRequest("วันสิ้นสุด Sprint ต้องไม่มาก่อนวันเริ่ม")

        if (input.status === "active" && current.status !== "active") {
            const running = await prisma.sprint.findFirst({
                where: { projectId: id, status: "active", id: { not: sprintId } },
                select: { name: true },
            })
            if (running) {
                return badRequest(
                    `โครงการนี้มี Sprint "${running.name}" กำลังดำเนินการอยู่ กรุณาปิดรอบก่อนเปิดรอบใหม่`
                )
            }
        }

        const data: Prisma.SprintUpdateInput = {}
        if (input.name !== undefined) data.name = input.name
        if (input.goal !== undefined) data.goal = input.goal ?? null
        if (input.startDate !== undefined) data.startDate = input.startDate
        if (input.endDate !== undefined) data.endDate = input.endDate
        if (input.status !== undefined) data.status = input.status

        const sprint = await prisma.sprint.update({
            where: { id: sprintId },
            data,
            select: sprintSelect,
        })

        return NextResponse.json({ sprint })
    } catch (error) {
        console.error("Sprint PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไข Sprint ได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("ลบ Sprint ได้เฉพาะหัวหน้างานขึ้นไป")
    const { id, sprintId } = await params

    try {
        const sprint = await prisma.sprint.findUnique({
            where: { id: sprintId },
            select: { id: true, projectId: true },
        })
        if (!sprint || sprint.projectId !== id) return notFound("ไม่พบ Sprint ที่ต้องการ")

        // FK ของ Task.sprintId ไม่ได้ตั้ง cascade อยู่แล้ว แต่ต้องคลายเองก่อนลบ
        // ไม่งั้นจะลบไม่ผ่าน — และงานที่ทำค้างไว้ต้องไม่หายไปพร้อมรอบพัฒนา
        const moved = await prisma.task.updateMany({
            where: { sprintId },
            data: { sprintId: null },
        })

        await prisma.sprint.delete({ where: { id: sprintId } })
        return NextResponse.json({ ok: true, movedToBacklog: moved.count })
    } catch (error) {
        console.error("Sprint DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบ Sprint ได้" }, { status: 500 })
    }
}
