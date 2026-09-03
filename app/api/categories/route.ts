// app/api/categories/route.ts
// GET  — รายการ Service Catalog (ทุก role อ่านได้ ใช้เติม dropdown ในฟอร์มแจ้งปัญหา)
// POST — เพิ่มหมวดหมู่ใหม่ (F1.8 — admin เท่านั้น ตาม spec §7)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole, badRequest, ADMIN_ROLES } from "@/lib/rbac"
import { createCategorySchema, firstIssueMessage } from "@/lib/ticket-schema"
import { categorySelect } from "@/lib/ticket-service"

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response

    // หน้าแจ้งปัญหาต้องการเฉพาะหมวดที่เปิดใช้งาน — หน้า admin ขอทั้งหมดด้วย ?all=1
    const includeInactive = new URL(request.url).searchParams.get("all") === "1"

    try {
        const categories = await prisma.serviceCategory.findMany({
            where: includeInactive ? {} : { active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: categorySelect,
        })
        return NextResponse.json({ categories })
    } catch (error) {
        console.error("Category GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดหมวดหมู่บริการได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createCategorySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        if (input.parentId) {
            const parent = await prisma.serviceCategory.findUnique({
                where: { id: input.parentId },
                select: { id: true, parentId: true },
            })
            if (!parent) return badRequest("ไม่พบหมวดหลักที่เลือก")
            // Catalog ลึกได้แค่ 2 ชั้น (หมวดหลัก → หมวดย่อย) ตาม spec §5.1
            if (parent.parentId) return badRequest("หมวดย่อยซ้อนได้เพียงชั้นเดียว")
        }

        const category = await prisma.serviceCategory.create({
            data: {
                name: input.name,
                slug: input.slug,
                parentId: input.parentId ?? null,
                description: input.description ?? null,
                defaultTeamId: input.defaultTeamId ?? null,
                defaultAssigneeId: input.defaultAssigneeId ?? null,
                active: input.active,
                sortOrder: input.sortOrder,
            },
            select: categorySelect,
        })

        return NextResponse.json({ category }, { status: 201 })
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return badRequest("slug นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนเป็นค่าอื่น")
        }
        console.error("Category POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกหมวดหมู่ได้" }, { status: 500 })
    }
}
