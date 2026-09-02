// app/api/kb/[id]/route.ts
// GET    — อ่านบทความด้วย id หรือ slug + นับ viewCount (F6.7)
// PATCH  — แก้ไขบทความ + re-index ถ้าบทความเผยแพร่อยู่ (F6.1, F6.9)
// DELETE — ลบบทความ + ถอน vector ออกจากคลังค้นหา (F6.10)
// ผ่าน NFR1 · NFR2 · NFR3 (ตรวจสิทธิ์ระดับแถวตาม visibility และเจ้าของบทความ)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole, badRequest, notFound, forbidden } from "@/lib/rbac"
import { updateKbArticleSchema } from "@/lib/kb-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import {
    buildUniqueSlug,
    canEditArticle,
    canReadArticle,
    kbDetailSelect,
} from "@/lib/kb-service"
import { removeArticleFromRag, syncArticleToRag } from "@/lib/kb-sync"

/// รับได้ทั้ง id และ slug — หน้าอ่านใช้ slug ส่วนหน้าจัดการใช้ id
function whereIdOrSlug(key: string) {
    return { OR: [{ id: key }, { slug: key }] }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    try {
        const article = await prisma.kbArticle.findFirst({
            where: whereIdOrSlug(id),
            select: kbDetailSelect,
        })
        if (!article) return notFound("ไม่พบบทความที่ต้องการ")
        if (!canReadArticle(user, article)) return forbidden("คุณไม่มีสิทธิ์อ่านบทความนี้")

        // F6.7 — นับยอดเข้าอ่าน เฉพาะบทความที่เผยแพร่แล้วและไม่ใช่ผู้เขียนเอง
        // (กันตัวเลขเฟ้อจากการที่ผู้เขียนเปิดดูงานตัวเองระหว่างแก้)
        if (article.status === "published" && article.authorId !== user.id) {
            await prisma.kbArticle.update({
                where: { id: article.id },
                data: { viewCount: { increment: 1 } },
            })
            article.viewCount += 1
        }

        return NextResponse.json({ article })
    } catch (error) {
        console.error("KB detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดบทความได้" }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateKbArticleSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    const existing = await prisma.kbArticle.findFirst({
        where: whereIdOrSlug(id),
        select: kbDetailSelect,
    })
    if (!existing) return notFound("ไม่พบบทความที่ต้องการ")
    if (!canEditArticle(user, existing)) {
        return forbidden("แก้ไขได้เฉพาะบทความของตัวเอง")
    }

    if (input.categoryId) {
        const category = await prisma.serviceCategory.findFirst({
            where: { id: input.categoryId, active: true },
            select: { id: true },
        })
        if (!category) return badRequest("ไม่พบหมวดหมู่บริการที่เลือก")
    }

    try {
        // เปลี่ยนหัวข้อ = เปลี่ยน slug ด้วย เพื่อให้ URL ยังสื่อความหมาย
        const slug =
            input.title && input.title !== existing.title
                ? await buildUniqueSlug(input.title, existing.id)
                : undefined

        const article = await prisma.kbArticle.update({
            where: { id: existing.id },
            data: {
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(slug ? { slug } : {}),
                ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
                ...(input.content !== undefined ? { content: input.content } : {}),
                ...(input.categoryId !== undefined
                    ? { categoryId: input.categoryId ?? null }
                    : {}),
                ...(input.tags !== undefined ? { tags: input.tags } : {}),
                ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
            },
            select: kbDetailSelect,
        })

        // F6.9 — บทความที่เผยแพร่อยู่ต้อง re-index ทันที ไม่งั้นแชตบอทจะยังตอบด้วยเนื้อหาเก่า
        let syncWarning: string | undefined
        if (article.status === "published") {
            const result = await syncArticleToRag(article, user.id)
            if (!result.ok) syncWarning = result.error
        }

        return NextResponse.json({ article, syncWarning })
    } catch (error) {
        console.error("KB PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไขได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // F6.5 — สิทธิ์ kb:delete มีเฉพาะ manager ขึ้นไป
    const guard = await requireRole(["manager", "admin"])
    if (!guard.ok) return guard.response

    const { id } = await params

    const existing = await prisma.kbArticle.findFirst({
        where: whereIdOrSlug(id),
        select: { id: true, knowledgeDocumentId: true },
    })
    if (!existing) return notFound("ไม่พบบทความที่ต้องการ")

    try {
        // ถอน vector ออกก่อนลบบทความ ไม่งั้นจะเหลือ chunk กำพร้าค้างใน pgvector ตลอดไป
        await removeArticleFromRag(existing)

        if (existing.knowledgeDocumentId) {
            await prisma.knowledgeDocument
                .delete({ where: { id: existing.knowledgeDocumentId } })
                .catch(() => undefined)
        }

        await prisma.kbArticle.delete({ where: { id: existing.id } })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("KB DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบบทความได้" }, { status: 500 })
    }
}
