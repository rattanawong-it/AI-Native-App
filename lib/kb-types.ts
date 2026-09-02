// lib/kb-types.ts
// ชนิดข้อมูลฝั่ง client ของ Knowledge Base — ให้หน้าจอกับ API พูดภาษาเดียวกัน
// อ้างอิง docs/spec.md §5.5 และ §8 ⑥

import type { KbStatus, KbVisibility } from "@/lib/kb-workflow"

export interface KbPerson {
    id: string
    name: string
    email?: string
}

export interface KbCategoryRef {
    id: string
    name: string
    slug: string
}

/// แถวในหน้ารายการ — ไม่มี `content` เพื่อให้ payload เบา
export interface KbArticleRow {
    id: string
    title: string
    slug: string
    summary: string | null
    tags: string[]
    status: KbStatus
    visibility: KbVisibility
    publishedAt: string | null
    viewCount: number
    helpfulCount: number
    notHelpfulCount: number
    isIndexed: boolean
    createdAt: string
    updatedAt: string
    category: KbCategoryRef | null
    author: KbPerson
    reviewer: KbPerson | null
}

/// บทความเต็มในหน้าอ่าน / หน้าแก้ไข
export interface KbArticleDetail extends KbArticleRow {
    content: string
    categoryId: string | null
    authorId: string
    reviewerId: string | null
    knowledgeDocumentId: string | null
}

export interface KbListResponse {
    articles: KbArticleRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface KbDetailResponse {
    article: KbArticleDetail
    syncWarning?: string
}

/// บทความที่ vector search แนะนำในหน้า Ticket (F6.12)
export interface KbSuggestion extends KbArticleRow {
    similarity: number
}

export interface KbSuggestResponse {
    suggestions: KbSuggestion[]
    /// true = ระบบค้นหาไม่พร้อมใช้งาน (embedding API ล่ม) — UI ควรซ่อนการ์ดไปเงียบๆ
    unavailable?: boolean
}

/// ตัวเลือกเรียงลำดับในหน้ารายการ (ตรงกับ listKbQuerySchema)
export const KB_SORT_OPTIONS = [
    { key: "latest", label: "เผยแพร่ล่าสุด" },
    { key: "popular", label: "เข้าอ่านมากสุด" },
    { key: "helpful", label: "มีประโยชน์มากสุด" },
    { key: "title", label: "ตามชื่อบทความ" },
] as const

/// ตัดเนื้อหา Markdown ให้เหลือข้อความสั้นๆ ใช้เป็นบทสรุปสำรองเมื่อบทความไม่ได้กรอก summary
export function excerptFromMarkdown(content: string, maxLength = 160): string {
    const plain = content
        .replace(/```[\s\S]*?```/g, " ") // code block
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // รูป
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // ลิงก์ เหลือแต่ข้อความ
        .replace(/[#>*_`~|-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain
}
