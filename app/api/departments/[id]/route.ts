// app/api/departments/[id]/route.ts
// PATCH  — แก้ไขหน่วยงาน (ชื่อ / รหัส / หน่วยงานแม่ / เปิด-ปิดใช้งาน)
// DELETE — ลบหน่วยงาน ถ้ามีผู้ใช้ / Ticket / ครุภัณฑ์ / หน่วยงานย่อยอ้างอยู่ จะปิดใช้งานแทน
// หัวหน้าขึ้นไป (manager, admin)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, MANAGER_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateDepartmentSchema, MAX_DEPARTMENT_LEVEL } from "@/lib/department-schema"
import {
    departmentSelect,
    toDepartmentDto,
    resolveDepartmentLevel,
    isDescendantOf,
} from "@/lib/department-service"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateDepartmentSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.department.findUnique({
            where: { id },
            select: { id: true, parentId: true, level: true },
        })
        if (!current) return notFound("ไม่พบหน่วยงานที่ต้องการ")

        // ย้ายหน่วยงานแม่ — ต้องคำนวณ level ใหม่และกันวงวน
        let level: number | undefined
        if (input.parentId !== undefined) {
            const nextParentId = input.parentId ?? null

            if (nextParentId === id) return badRequest("ตั้งหน่วยงานแม่เป็นตัวเองไม่ได้")
            if (nextParentId && (await isDescendantOf(nextParentId, id))) {
                return badRequest("ตั้งหน่วยงานแม่เป็นหน่วยงานย่อยของตัวเองไม่ได้")
            }

            const resolved = await resolveDepartmentLevel(nextParentId)
            if (!resolved.ok) return badRequest(resolved.error)

            // ย้ายแล้วลูกที่มีอยู่ต้องไม่ทะลุชั้นล่างสุด
            const childCount = await prisma.department.count({ where: { parentId: id } })
            if (childCount > 0 && resolved.level >= MAX_DEPARTMENT_LEVEL) {
                return badRequest("ย้ายไม่ได้ — หน่วยงานนี้มีหน่วยงานย่อยที่จะลึกเกินกำหนด")
            }
            level = resolved.level
        }

        const department = await prisma.department.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.code !== undefined ? { code: input.code } : {}),
                ...(input.parentId !== undefined ? { parentId: input.parentId ?? null } : {}),
                ...(level !== undefined ? { level } : {}),
                ...(input.active !== undefined ? { active: input.active } : {}),
            },
            select: departmentSelect,
        })

        // level ของลูกต้องขยับตามแม่ (ลึกได้แค่ 3 ชั้น จึงมีชั้นเดียวที่ต้องตาม)
        if (level !== undefined && level !== current.level) {
            await prisma.department.updateMany({
                where: { parentId: id },
                data: { level: level + 1 },
            })
        }

        return NextResponse.json({ department: toDepartmentDto(department) })
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return badRequest("รหัสหน่วยงานนี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนเป็นค่าอื่น")
        }
        console.error("Departments PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกหน่วยงานได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const current = await prisma.department.findUnique({
            where: { id },
            select: {
                id: true,
                _count: { select: { users: true, tickets: true, assets: true, children: true } },
            },
        })
        if (!current) return notFound("ไม่พบหน่วยงานที่ต้องการ")

        const referenced =
            current._count.users +
            current._count.tickets +
            current._count.assets +
            current._count.children

        // ไม่มีอะไรอ้างถึง → ลบออกได้จริง
        if (referenced === 0) {
            await prisma.department.delete({ where: { id } })
            return NextResponse.json({ deleted: true })
        }

        // มีข้อมูลอ้างอยู่ → ปิดใช้งานแทน เพื่อรักษาประวัติเดิม
        const department = await prisma.department.update({
            where: { id },
            data: { active: false },
            select: departmentSelect,
        })
        return NextResponse.json({ deleted: false, department: toDepartmentDto(department) })
    } catch (error) {
        console.error("Departments DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบหน่วยงานได้" }, { status: 500 })
    }
}
