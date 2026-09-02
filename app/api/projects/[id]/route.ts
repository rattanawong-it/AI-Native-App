// app/api/projects/[id]/route.ts
// GET    — ภาพรวมโครงการ + Sprint ทั้งหมด + สรุปกระดาน (F5.2, F5.10)
// PATCH  — แก้ไขรายละเอียดโครงการ (F5.1)
// DELETE — ลบโครงการ (ลบ Sprint และ Task ที่อยู่ข้างในตาม cascade ของ schema)
//
// สิทธิ์ตาม spec §7 — อ่านได้ตั้งแต่เจ้าหน้าที่ · แก้/ลบเฉพาะหัวหน้าขึ้นไป

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, notFound } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateProjectSchema } from "@/lib/project-schema"
import {
    SDLC_ROLES,
    canManageProject,
    decimalOrNull,
    loggedHoursByTask,
    projectListSelect,
    sprintSelect,
    summarizeBoard,
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
        const project = await prisma.project.findUnique({
            where: { id },
            select: projectListSelect,
        })
        if (!project) return notFound("ไม่พบโครงการที่ต้องการ")

        const [sprints, tasks] = await Promise.all([
            prisma.sprint.findMany({
                where: { projectId: id },
                select: sprintSelect,
                orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }],
            }),
            // ดึงเฉพาะคอลัมน์ที่ใช้สรุป — ไม่ต้องขนการ์ดทั้งใบมาคำนวณ
            prisma.task.findMany({
                where: { projectId: id },
                select: { id: true, boardStatus: true, estimateHours: true },
            }),
        ])

        const logged = await loggedHoursByTask(tasks.map((t) => t.id))
        const board = summarizeBoard(
            tasks.map((t) => ({
                boardStatus: t.boardStatus,
                estimateHours: decimalOrNull(t.estimateHours),
                loggedHours: logged.get(t.id) ?? 0,
            }))
        )

        return NextResponse.json({
            project: { ...project, doneTasks: board.done, sprints, board },
        })
    } catch (error) {
        console.error("Project detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลโครงการได้" }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("แก้ไขโครงการได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateProjectSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.project.findUnique({
            where: { id },
            select: { id: true, code: true, startDate: true, endDate: true },
        })
        if (!current) return notFound("ไม่พบโครงการที่ต้องการ")

        if (input.code && input.code !== current.code) {
            const duplicate = await prisma.project.findUnique({
                where: { code: input.code },
                select: { id: true },
            })
            if (duplicate) return badRequest(`รหัสโครงการ "${input.code}" ถูกใช้ไปแล้ว`)
        }

        if (input.ownerId) {
            const ownerError = await validateAssignee(input.ownerId)
            if (ownerError) return badRequest("ไม่พบผู้ใช้ที่เลือกเป็นเจ้าของโครงการ")
        }

        if (input.teamId) {
            const team = await prisma.team.findUnique({
                where: { id: input.teamId },
                select: { id: true },
            })
            if (!team) return badRequest("ไม่พบทีมที่เลือก")
        }

        // ส่งมาแค่ด้านเดียวก็ต้องเทียบกับค่าที่เก็บไว้ ไม่งั้นช่วงวันที่กลับหัวได้
        const startDate = input.startDate !== undefined ? input.startDate : current.startDate
        const endDate = input.endDate !== undefined ? input.endDate : current.endDate
        if (startDate && endDate && startDate > endDate) {
            return badRequest("วันสิ้นสุดต้องไม่มาก่อนวันเริ่มโครงการ")
        }

        const data: Prisma.ProjectUpdateInput = {}
        if (input.code !== undefined) data.code = input.code
        if (input.name !== undefined) data.name = input.name
        if (input.description !== undefined) data.description = input.description ?? null
        if (input.status !== undefined) data.status = input.status
        if (input.ownerId !== undefined) data.owner = { connect: { id: input.ownerId } }
        if (input.teamId !== undefined) {
            data.team = input.teamId ? { connect: { id: input.teamId } } : { disconnect: true }
        }
        if (input.startDate !== undefined) data.startDate = input.startDate ?? null
        if (input.endDate !== undefined) data.endDate = input.endDate ?? null

        const project = await prisma.project.update({
            where: { id },
            data,
            select: projectListSelect,
        })

        const doneTasks = await prisma.task.count({
            where: { projectId: id, boardStatus: "done" },
        })

        return NextResponse.json({ project: { ...project, doneTasks } })
    } catch (error) {
        console.error("Project PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไขโครงการได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...SDLC_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard
    if (!canManageProject(user)) return forbidden("ลบโครงการได้เฉพาะหัวหน้างานขึ้นไป")
    const { id } = await params

    try {
        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true, _count: { select: { tasks: true } } },
        })
        if (!project) return notFound("ไม่พบโครงการที่ต้องการ")

        // Task ที่มีบันทึกเวลาผูกอยู่ลบไม่ได้ (FK ของ WorkLog.taskId ไม่ได้ตั้ง cascade)
        // — บันทึกเวลาเป็นหลักฐานภาระงาน ต้องไม่หายไปพร้อมการลบโครงการ
        const loggedTasks = await prisma.task.count({
            where: { projectId: id, workLogs: { some: {} } },
        })
        if (loggedTasks > 0) {
            return badRequest(
                `ลบไม่ได้ — มีงาน ${loggedTasks} รายการที่มีบันทึกเวลาทำงานผูกอยู่ กรุณาปิดโครงการแทนการลบ`
            )
        }

        // Ticket ที่เคยแปลงมาเป็น Task ในโครงการนี้ต้องคลายลิงก์ก่อน ไม่งั้น FK ค้าง
        await prisma.ticket.updateMany({
            where: { convertedTask: { projectId: id } },
            data: { convertedTaskId: null },
        })

        await prisma.project.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Project DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบโครงการได้" }, { status: 500 })
    }
}
