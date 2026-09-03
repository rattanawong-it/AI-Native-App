// app/api/kb/[id]/publish/route.ts
// POST — เปลี่ยนสถานะบทความตาม workflow แล้ว sync เข้า/ออก Vector DB (F6.4, F6.5, F6.9, F6.10)
//
// ทำไมต้องแยกจาก PATCH: การเปลี่ยนสถานะมีผลข้างเคียงที่ PATCH ไม่มี — เข้า published
// ต้อง embed ลง pgvector, ออกจาก published ต้องลบ vector ทิ้ง แยกเส้นทางไว้ทำให้
// ไม่มีทางที่บทความจะกลายเป็น published โดยข้ามขั้นตอน index
// ผ่าน NFR1 · NFR2 · NFR3

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden, STAFF_ROLES } from "@/lib/rbac"
import { changeKbStatusSchema } from "@/lib/kb-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { canEditArticle, canPublishArticle, kbDetailSelect } from "@/lib/kb-service"
import { removeArticleFromRag, syncArticleToRag } from "@/lib/kb-sync"
import {
    KB_STATUS_LABEL,
    requiresPublishRight,
    transitionError,
} from "@/lib/kb-workflow"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = changeKbStatusSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const { status: nextStatus, note } = parsed.data

    const existing = await prisma.kbArticle.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        select: kbDetailSelect,
    })
    if (!existing) return notFound("ไม่พบบทความที่ต้องการ")

    // ผู้เขียนส่งตรวจ/ถอนกลับเป็นร่างเองได้ แต่การเผยแพร่ต้องเป็น manager ขึ้นไป (F6.5)
    if (!canEditArticle(user, existing)) {
        return forbidden("จัดการได้เฉพาะบทความของตัวเอง")
    }
    if (requiresPublishRight(nextStatus) && !canPublishArticle(user)) {
        return forbidden("การเผยแพร่บทความต้องใช้สิทธิ์หัวหน้างานขึ้นไป")
    }

    const invalid = transitionError(existing.status, nextStatus)
    if (invalid) return badRequest(invalid)

    try {
        const article = await prisma.kbArticle.update({
            where: { id: existing.id },
            data: {
                status: nextStatus,
                // บันทึกผู้ตรวจไว้เมื่อเผยแพร่ เพื่อให้รู้ว่าใครเป็นคนอนุมัติ
                ...(nextStatus === "published"
                    ? { reviewerId: user.id, publishedAt: existing.publishedAt ?? new Date() }
                    : {}),
            },
            select: kbDetailSelect,
        })

        // ผลข้างเคียงต่อ Vector DB
        let syncWarning: string | undefined
        if (nextStatus === "published") {
            const result = await syncArticleToRag(article, user.id)
            if (!result.ok) syncWarning = result.error
        } else if (existing.status === "published") {
            // ออกจาก published (ถอนกลับเป็นร่าง หรือเก็บเข้ากรุ) → ถอนออกจากคลังค้นหา (F6.10)
            const result = await removeArticleFromRag(article)
            if (!result.ok) syncWarning = result.error
        }

        // อ่านค่าธง isIndexed ใหม่หลัง sync เพราะ kb-sync เป็นคนอัปเดตค่านี้
        const fresh = await prisma.kbArticle.findUnique({
            where: { id: article.id },
            select: kbDetailSelect,
        })

        return NextResponse.json({
            article: fresh ?? article,
            message: `เปลี่ยนสถานะเป็น "${KB_STATUS_LABEL[nextStatus]}" แล้ว`,
            note: note ?? null,
            syncWarning,
        })
    } catch (error) {
        console.error("KB publish Error:", error)
        return NextResponse.json({ error: "ไม่สามารถเปลี่ยนสถานะบทความได้" }, { status: 500 })
    }
}
