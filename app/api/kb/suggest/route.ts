// app/api/kb/suggest/route.ts
// GET — แนะนำบทความ KB ที่เกี่ยวข้องกับ Ticket ด้วย vector search (F6.12)
//
// รับได้ 2 แบบ: `ticketId` (ดึง title + description มาเป็นคำค้นให้เอง) หรือ `q` (คำค้นตรงๆ)
// ผ่าน NFR1 · NFR2 · NFR3 (ตรวจสิทธิ์อ่าน Ticket ก่อน แล้วกรองบทความตาม visibility อีกชั้น)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
    requireAuth,
    badRequest,
    notFound,
    forbidden,
    canAccessTicket,
} from "@/lib/rbac"
import { suggestKbQuerySchema } from "@/lib/kb-schema"
import { searchParamsToObject, firstIssueMessage } from "@/lib/ticket-schema"
import { searchKbArticles } from "@/lib/vector-search"
import { articleIdFromSource } from "@/lib/kb-sync"
import { canReadArticle, kbListSelect } from "@/lib/kb-service"

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = suggestKbQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    if (!query.ticketId && !query.q) {
        return badRequest("กรุณาระบุ ticketId หรือคำค้น")
    }

    let searchText = query.q ?? ""

    if (query.ticketId) {
        const ticket = await prisma.ticket.findUnique({
            where: { id: query.ticketId },
            select: { title: true, description: true, requesterId: true, assigneeId: true },
        })
        if (!ticket) return notFound("ไม่พบ Ticket ที่ระบุ")
        if (!canAccessTicket(user, ticket)) return forbidden("คุณไม่มีสิทธิ์เข้าถึง Ticket นี้")

        searchText = `${ticket.title}\n${ticket.description}`
    }

    try {
        // ดึงเผื่อไว้มากกว่าที่ขอ เพราะหลาย chunk อาจมาจากบทความเดียวกัน
        // และบางบทความจะถูกกรองทิ้งด้วยสิทธิ์การมองเห็นในขั้นถัดไป
        const chunks = await searchKbArticles(searchText, query.topK * 4)

        // รวม chunk ที่มาจากบทความเดียวกัน เก็บคะแนนสูงสุดไว้เป็นตัวแทน
        const bestScore = new Map<string, number>()
        for (const chunk of chunks) {
            const articleId = articleIdFromSource(chunk.metadata?.source)
            if (!articleId) continue
            const current = bestScore.get(articleId) ?? 0
            if (chunk.similarity > current) bestScore.set(articleId, chunk.similarity)
        }

        if (bestScore.size === 0) return NextResponse.json({ suggestions: [] })

        const articles = await prisma.kbArticle.findMany({
            where: { id: { in: [...bestScore.keys()] }, status: "published" },
            select: { ...kbListSelect, authorId: true },
        })

        const suggestions = articles
            .filter((article) => canReadArticle(user, article))
            .map((article) => ({
                ...article,
                similarity: bestScore.get(article.id) ?? 0,
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, query.topK)

        return NextResponse.json({ suggestions })
    } catch (error) {
        console.error("KB suggest Error:", error)
        // การค้นด้วย vector ต้องเรียก embedding API ซึ่งล่มได้ — หน้า Ticket ต้องไม่พังตาม
        // จึงคืนรายการว่างพร้อมธงบอกสาเหตุ ให้ UI ซ่อนการ์ดแนะนำไปเงียบๆ
        return NextResponse.json({ suggestions: [], unavailable: true })
    }
}
