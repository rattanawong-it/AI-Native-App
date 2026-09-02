// lib/kb-service.ts
// Helper กลางของ Knowledge Base — select shape, ตัวกรอง, สิทธิ์ระดับแถว, slug
// อ้างอิง docs/spec.md §5.5 และ §8 ⑥ (F6.1–F6.8)

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"
import { AuthUser, isStaff, isManager } from "@/lib/rbac"
import { slugifyTitle } from "@/lib/kb-workflow"
import type { ListKbQuery } from "@/lib/kb-schema"

/// ฟิลด์ที่ส่งกลับในหน้ารายการ — ไม่ดึง `content` เพื่อไม่ให้ payload บวม
export const kbListSelect = {
    id: true,
    title: true,
    slug: true,
    summary: true,
    tags: true,
    status: true,
    visibility: true,
    publishedAt: true,
    viewCount: true,
    helpfulCount: true,
    notHelpfulCount: true,
    isIndexed: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { id: true, name: true, slug: true } },
    author: { select: { id: true, name: true, email: true } },
    reviewer: { select: { id: true, name: true } },
} satisfies Prisma.KbArticleSelect

/// หน้าอ่านบทความ — เพิ่ม `content` และ id ของเอกสาร RAG ที่ผูกไว้
export const kbDetailSelect = {
    ...kbListSelect,
    content: true,
    categoryId: true,
    authorId: true,
    reviewerId: true,
    knowledgeDocumentId: true,
} satisfies Prisma.KbArticleSelect

export type KbListItem = Prisma.KbArticleGetPayload<{ select: typeof kbListSelect }>
export type KbDetail = Prisma.KbArticleGetPayload<{ select: typeof kbDetailSelect }>

// ── สิทธิ์ระดับแถว (NFR3, F6.6) ───────────────────────────────────────

/// เงื่อนไข where ที่จำกัดตามสิทธิ์ผู้ใช้
/// - ผู้ใช้ทั่วไป: เห็นเฉพาะบทความ published + visibility `all` และบทความของตัวเอง
/// - เจ้าหน้าที่ขึ้นไป: เห็นได้ทุกบทความ (รวม agent_only และฉบับร่างของคนอื่น)
export function kbScopeWhere(user: AuthUser | null): Prisma.KbArticleWhereInput {
    if (user && isStaff(user)) return {}

    const publicOnly: Prisma.KbArticleWhereInput = {
        status: "published",
        visibility: "all",
    }

    if (!user) return publicOnly
    return { OR: [publicOnly, { authorId: user.id }] }
}

/// อ่านบทความนี้ได้ไหม (ใช้ตรวจซ้ำหลังดึงข้อมูลมาแล้ว)
export function canReadArticle(
    user: AuthUser | null,
    article: { status: string; visibility: string; authorId: string }
): boolean {
    if (user && isStaff(user)) return true
    if (user && article.authorId === user.id) return true
    return article.status === "published" && article.visibility === "all"
}

/// แก้ไขบทความได้ไหม — `manager` ขึ้นไปแก้ได้ทุกใบ, `agent` แก้ได้เฉพาะบทความของตัวเอง (F6.5)
export function canEditArticle(user: AuthUser, article: { authorId: string }): boolean {
    if (isManager(user)) return true
    return isStaff(user) && article.authorId === user.id
}

/// Publish / Un-publish ได้ไหม — `manager` ขึ้นไปเท่านั้น (F6.5)
export function canPublishArticle(user: AuthUser): boolean {
    return isManager(user)
}

// ── ตัวกรองและการเรียงลำดับ (F6.3) ────────────────────────────────────

export function buildKbWhere(
    query: ListKbQuery,
    user: AuthUser | null
): Prisma.KbArticleWhereInput {
    const and: Prisma.KbArticleWhereInput[] = [kbScopeWhere(user)]

    if (query.publishedOnly) and.push({ status: "published" })
    else if (query.status) and.push({ status: query.status })

    if (query.visibility) and.push({ visibility: query.visibility })
    if (query.categoryId) and.push({ categoryId: query.categoryId })
    if (query.tag) and.push({ tags: { has: query.tag } })

    if (query.q) {
        and.push({
            OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { summary: { contains: query.q, mode: "insensitive" } },
                { content: { contains: query.q, mode: "insensitive" } },
                { tags: { has: query.q } },
            ],
        })
    }

    return and.length === 1 ? and[0] : { AND: and }
}

export function buildKbOrderBy(
    sort: ListKbQuery["sort"]
): Prisma.KbArticleOrderByWithRelationInput[] {
    switch (sort) {
        case "popular":
            return [{ viewCount: "desc" }, { updatedAt: "desc" }]
        case "helpful":
            return [{ helpfulCount: "desc" }, { viewCount: "desc" }]
        case "title":
            return [{ title: "asc" }]
        default:
            return [{ publishedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
    }
}

// ── Slug ที่ไม่ชนกัน (F6.1) ───────────────────────────────────────────

/// สร้าง slug ที่ไม่ซ้ำกับบทความอื่น — ชนเมื่อไหร่ต่อท้ายด้วยรหัสสุ่มสั้นๆ
/// `excludeId` ใช้ตอนแก้ไขบทความเดิม จะได้ไม่นับ slug ของตัวเองว่าชน
export async function buildUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugifyTitle(title)

    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = attempt === 0 ? base : `${base}-${nanoid(6).toLowerCase()}`
        const taken = await prisma.kbArticle.findFirst({
            where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
            select: { id: true },
        })
        if (!taken) return candidate
    }

    // กันเหนียว: ถ้าสุ่ม 5 ครั้งยังชน ใช้ timestamp ปิดท้ายซึ่งไม่มีทางซ้ำ
    return `${base}-${Date.now()}`
}

// ── ข้อความสำหรับ RAG (F6.9) ─────────────────────────────────────────

/// รวมหัวข้อ + บทสรุป + แท็ก + เนื้อหา ให้เป็นก้อนเดียวก่อนส่งไป chunk + embed
/// ใส่หัวข้อไว้บนสุดเพราะ chunk แรกมักถูกดึงมาตอบบ่อยที่สุด
export function buildArticleDocumentText(article: {
    title: string
    summary?: string | null
    tags: string[]
    content: string
}): string {
    const parts = [`หัวข้อ: ${article.title}`]
    if (article.summary) parts.push(`สรุป: ${article.summary}`)
    if (article.tags.length > 0) parts.push(`แท็ก: ${article.tags.join(", ")}`)
    parts.push(article.content)
    return parts.join("\n\n")
}
