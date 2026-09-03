// app/api/sla-policies/[id]/route.ts
// PATCH  — แก้ไขนโยบาย SLA (F4.1)
// DELETE — ลบนโยบาย SLA — ลบได้จริงเพราะ Ticket เก็บกำหนดเวลาไว้ในแถวของตัวเองแล้ว
//          (ไม่มี FK จาก Ticket มาที่ SlaPolicy) ใบเก่าจึงไม่ได้รับผลกระทบ
// admin เท่านั้น ตาม spec §7

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, ADMIN_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateSlaPolicySchema } from "@/lib/sla-schema"
import { slaPolicySelect } from "@/lib/sla-service"

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

    const parsed = updateSlaPolicySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.slaPolicy.findUnique({
            where: { id },
            select: {
                id: true,
                priority: true,
                categoryId: true,
                responseMinutes: true,
                resolutionMinutes: true,
            },
        })
        if (!current) return notFound("ไม่พบนโยบาย SLA ที่ต้องการ")

        // ส่งมาแก้ทีละฟิลด์ได้ จึงต้องเทียบกับค่าเดิมว่าคู่เวลายังสมเหตุสมผล
        const responseMinutes = input.responseMinutes ?? current.responseMinutes
        const resolutionMinutes = input.resolutionMinutes ?? current.resolutionMinutes
        if (resolutionMinutes < responseMinutes) {
            return badRequest("เวลาแก้ไขต้องไม่น้อยกว่าเวลาตอบกลับ")
        }

        const priority = input.priority ?? current.priority
        const categoryId =
            input.categoryId !== undefined ? (input.categoryId ?? null) : current.categoryId

        if (categoryId && categoryId !== current.categoryId) {
            const category = await prisma.serviceCategory.findUnique({
                where: { id: categoryId },
                select: { id: true },
            })
            if (!category) return badRequest("ไม่พบหมวดหมู่ที่เลือก")
        }

        if (priority !== current.priority || categoryId !== current.categoryId) {
            const duplicate = await prisma.slaPolicy.findFirst({
                where: { priority, categoryId, NOT: { id } },
                select: { id: true },
            })
            if (duplicate) {
                return badRequest("มีนโยบายของระดับความสำคัญนี้ในหมวดหมู่ที่เลือกอยู่แล้ว")
            }
        }

        const policy = await prisma.slaPolicy.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.priority !== undefined ? { priority: input.priority } : {}),
                ...(input.categoryId !== undefined ? { categoryId: input.categoryId ?? null } : {}),
                ...(input.responseMinutes !== undefined ? { responseMinutes } : {}),
                ...(input.resolutionMinutes !== undefined ? { resolutionMinutes } : {}),
                ...(input.active !== undefined ? { active: input.active } : {}),
            },
            select: slaPolicySelect,
        })

        return NextResponse.json({ policy })
    } catch (error) {
        console.error("SlaPolicy PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแก้ไขนโยบาย SLA ได้" }, { status: 500 })
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
        const current = await prisma.slaPolicy.findUnique({ where: { id }, select: { id: true } })
        if (!current) return notFound("ไม่พบนโยบาย SLA ที่ต้องการ")

        await prisma.slaPolicy.delete({ where: { id } })
        return NextResponse.json({ deleted: true })
    } catch (error) {
        console.error("SlaPolicy DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบนโยบาย SLA ได้" }, { status: 500 })
    }
}
