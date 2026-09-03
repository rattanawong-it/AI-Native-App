// app/api/kb/route.ts
// GET  — รายการบทความ พร้อมค้นหา / ฟิลเตอร์หมวดหมู่+แท็ก / pagination (F6.1, F6.3)
// POST — สร้างบทความใหม่เป็นฉบับร่าง + gen slug ที่ไม่ซ้ำ (F6.1, F6.13)
// ผ่าน NFR1 (ตรวจ session) · NFR2 (zod) · NFR3 (row-level scope ตาม visibility)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole, badRequest, STAFF_ROLES } from "@/lib/rbac"
import { createKbArticleSchema, listKbQuerySchema } from "@/lib/kb-schema"
import { searchParamsToObject, firstIssueMessage } from "@/lib/ticket-schema"
import {
    buildKbOrderBy,
    buildKbWhere,
    buildUniqueSlug,
    kbListSelect,
} from "@/lib/kb-service"

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listKbQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where = buildKbWhere(query, user)

    try {
        const [total, articles] = await Promise.all([
            prisma.kbArticle.count({ where }),
            prisma.kbArticle.findMany({
                where,
                select: kbListSelect,
                orderBy: buildKbOrderBy(query.sort),
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
        ])

        return NextResponse.json({
            articles,
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("KB GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการบทความได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    // F6.5 — เขียนบทความได้ตั้งแต่ระดับเจ้าหน้าที่ขึ้นไป
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createKbArticleSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    if (input.categoryId) {
        const category = await prisma.serviceCategory.findFirst({
            where: { id: input.categoryId, active: true },
            select: { id: true },
        })
        if (!category) return badRequest("ไม่พบหมวดหมู่บริการที่เลือก")
    }

    try {
        // บทความเกิดใหม่เป็นฉบับร่างเสมอ — การเผยแพร่ต้องไปผ่าน endpoint publish
        // เพื่อให้ sync เข้า RAG ทำงานทุกครั้ง ไม่มีทางลัดที่ทำให้บทความ published แต่ไม่ถูก index
        const article = await prisma.kbArticle.create({
            data: {
                title: input.title,
                slug: await buildUniqueSlug(input.title),
                summary: input.summary ?? null,
                content: input.content,
                categoryId: input.categoryId ?? null,
                tags: input.tags ?? [],
                visibility: input.visibility,
                status: "draft",
                authorId: user.id,
            },
            select: kbListSelect,
        })

        return NextResponse.json({ article }, { status: 201 })
    } catch (error) {
        console.error("KB POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกบทความได้" }, { status: 500 })
    }
}
