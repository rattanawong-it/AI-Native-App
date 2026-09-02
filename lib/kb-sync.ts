// lib/kb-sync.ts
// สะพานเชื่อมบทความ KB → Vector DB (F6.9, F6.10)
//
// Flow ตาม docs/spec.md §5.5:
//   Publish   → สร้าง/อัปเดต KnowledgeDocument → reingest เข้า pgvector → isIndexed = true
//   Un-publish/Archive → ลบ vector ที่เกี่ยวข้องออก → isIndexed = false
//
// หมายเหตุ: ทุกฟังก์ชันในไฟล์นี้ "ไม่ throw" ออกไปข้างนอก เพราะการ embed ต้องเรียก
// OpenAI ซึ่งล่ม/หมดเครดิตได้ — ถ้า sync พลาดต้องไม่ทำให้การ publish ล้มทั้งรายการ
// ผู้เรียกดูผลได้จากค่าที่คืนกลับ (`ok` + `error`) แล้วเอาไปแจ้งผู้ใช้เอง

import { prisma } from "@/lib/prisma"
import { reingestDocument, deleteVectorsByDocumentId } from "@/lib/ingestion"
import { buildArticleDocumentText } from "@/lib/kb-service"

export interface KbSyncResult {
    ok: boolean
    knowledgeDocumentId?: string
    error?: string
}

/// prefix ของ metadata.source ที่ใช้แยกว่า chunk นี้มาจากบทความ KB (คู่กับ searchKbArticles)
export function kbSourceTag(articleId: string): string {
    return `kb:${articleId}`
}

interface SyncableArticle {
    id: string
    title: string
    summary: string | null
    tags: string[]
    content: string
    knowledgeDocumentId: string | null
}

/**
 * Publish → ดันบทความเข้า Vector DB (F6.9)
 * เรียกซ้ำได้ปลอดภัย — ครั้งที่สองจะลบ chunk เก่าทิ้งก่อน ingest ใหม่เสมอ
 */
export async function syncArticleToRag(
    article: SyncableArticle,
    actorId: string
): Promise<KbSyncResult> {
    try {
        const text = buildArticleDocumentText(article)

        // 1. สร้าง/อัปเดต KnowledgeDocument ให้เป็นตัวแทนบทความใบนี้ในระบบ RAG เดิม
        const knowledgeDocument = article.knowledgeDocumentId
            ? await prisma.knowledgeDocument.update({
                  where: { id: article.knowledgeDocumentId },
                  data: { title: article.title, content: text, isIndexed: false },
              })
            : await prisma.knowledgeDocument.create({
                  data: {
                      title: article.title,
                      content: text,
                      source: kbSourceTag(article.id),
                      fileType: "manual",
                      isIndexed: false,
                      createdBy: actorId,
                  },
              })

        // 2. chunk + embed ลง pgvector (ลบของเก่าก่อน กันเนื้อหาเวอร์ชันเดิมค้าง)
        await reingestDocument(text, {
            source: kbSourceTag(article.id),
            documentId: knowledgeDocument.id,
        })

        // 3. ติดธงว่า index แล้วทั้งสองฝั่ง
        await prisma.knowledgeDocument.update({
            where: { id: knowledgeDocument.id },
            data: { isIndexed: true },
        })
        await prisma.kbArticle.update({
            where: { id: article.id },
            data: { knowledgeDocumentId: knowledgeDocument.id, isIndexed: true },
        })

        return { ok: true, knowledgeDocumentId: knowledgeDocument.id }
    } catch (error) {
        console.error("KB RAG sync error:", error)
        await prisma.kbArticle
            .update({ where: { id: article.id }, data: { isIndexed: false } })
            .catch(() => undefined)

        return {
            ok: false,
            error: error instanceof Error ? error.message : "sync เข้าคลังค้นหาไม่สำเร็จ",
        }
    }
}

/**
 * Un-publish / Archive → ถอนบทความออกจาก Vector DB (F6.10)
 * เก็บ KnowledgeDocument ไว้ (ตั้ง isIndexed = false) เพื่อให้ publish ซ้ำใช้ id เดิมได้
 */
export async function removeArticleFromRag(article: {
    id: string
    knowledgeDocumentId: string | null
}): Promise<KbSyncResult> {
    if (!article.knowledgeDocumentId) {
        // ยังไม่เคย sync — ไม่มีอะไรต้องลบ แต่ยังตั้งธงให้ตรงกับความจริง
        await prisma.kbArticle.update({
            where: { id: article.id },
            data: { isIndexed: false },
        })
        return { ok: true }
    }

    try {
        await deleteVectorsByDocumentId(article.knowledgeDocumentId)
        await prisma.knowledgeDocument.update({
            where: { id: article.knowledgeDocumentId },
            data: { isIndexed: false },
        })
        await prisma.kbArticle.update({
            where: { id: article.id },
            data: { isIndexed: false },
        })

        return { ok: true, knowledgeDocumentId: article.knowledgeDocumentId }
    } catch (error) {
        console.error("KB RAG un-sync error:", error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : "ถอนบทความออกจากคลังค้นหาไม่สำเร็จ",
        }
    }
}

/// ดึง articleId กลับจาก metadata.source ของ chunk ("kb:<id>" → "<id>")
export function articleIdFromSource(source: unknown): string | null {
    if (typeof source !== "string" || !source.startsWith("kb:")) return null
    return source.slice(3) || null
}
