// app/api/categories/[id]/route.ts
// PATCH  — แก้ไขหมวดหมู่บริการ (F1.8)
// DELETE — ปิดใช้งานหมวดหมู่ (soft delete — ลบจริงไม่ได้เพราะ Ticket เดิมอ้างอยู่)
// admin เท่านั้น ตาม spec §7 (ตั้งค่า SLA / Catalog / ปฏิทิน)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, ADMIN_ROLES } from "@/lib/rbac"
import { updateCategorySchema, firstIssueMessage } from "@/lib/ticket-schema"
import { categorySelect } from "@/lib/ticket-service"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateCategorySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.serviceCategory.findUnique({
            where: { id },
            select: { id: true, parentId: true, _count: { select: { children: true } } },
        })
        if (!current) return notFound("ไม่พบหมวดหมู่ที่ต้องการ")

        if (input.parentId !== undefined && input.parentId !== null) {
            if (input.parentId === id) return badRequest("หมวดหมู่เป็นหมวดหลักของตัวเองไม่ได้")
            if (current._count.children > 0) {
                return badRequest("หมวดนี้มีหมวดย่อยอยู่ จึงย้ายไปเป็นหมวดย่อยของหมวดอื่นไม่ได้")
            }
            const parent = await prisma.serviceCategory.findUnique({
                where: { id: input.parentId },
                select: { id: true, parentId: true },
            })
            if (!parent) return badRequest("ไม่พบหมวดหลักที่เลือก")
            if (parent.parentId) return badRequest("หมวดย่อยซ้อนได้เพียงชั้นเดียว")
        }

        const category = await prisma.serviceCategory.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.slug !== undefined ? { slug: input.slug } : {}),
                ...(input.parentId !== undefined ? { parentId: input.parentId ?? null } : {}),
                ...(input.description !== undefined
                    ? { description: input.description ?? null }
                    : {}),
                ...(input.defaultTeamId !== undefined
                    ? { defaultTeamId: input.defaultTeamId ?? null }
                    : {}),
                ...(input.defaultAssigneeId !== undefined
                    ? { defaultAssigneeId: input.defaultAssigneeId ?? null }
                    : {}),
                ...(input.active !== undefined ? { active: input.active } : {}),
                ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            },
            select: categorySelect,
        })

        return NextResponse.json({ category })
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return badRequest("slug นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนเป็นค่าอื่น")
        }
        console.error("Category PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแก้ไขหมวดหมู่ได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const current = await prisma.serviceCategory.findUnique({
            where: { id },
            select: { id: true, _count: { select: { tickets: true, children: true } } },
        })
        if (!current) return notFound("ไม่พบหมวดหมู่ที่ต้องการ")

        // ไม่มี Ticket และไม่มีหมวดย่อย → ลบออกได้จริง
        if (current._count.tickets === 0 && current._count.children === 0) {
            await prisma.serviceCategory.delete({ where: { id } })
            return NextResponse.json({ deleted: true })
        }

        // มีข้อมูลอ้างอยู่ → ปิดใช้งานแทน เพื่อรักษาประวัติ Ticket เดิม
        const category = await prisma.serviceCategory.update({
            where: { id },
            data: { active: false },
            select: categorySelect,
        })
        return NextResponse.json({ deleted: false, category })
    } catch (error) {
        console.error("Category DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบหมวดหมู่ได้" }, { status: 500 })
    }
}
