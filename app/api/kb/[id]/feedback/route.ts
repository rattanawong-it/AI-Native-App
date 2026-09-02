// app/api/kb/[id]/feedback/route.ts
// POST — โหวต "มีประโยชน์ / ไม่มีประโยชน์" + อัปเดตตัวนับบนบทความ (F6.8)
// ผ่าน NFR1 · NFR2 · NFR3

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, badRequest, notFound, forbidden } from "@/lib/rbac"
import { kbFeedbackSchema } from "@/lib/kb-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { canReadArticle } from "@/lib/kb-service"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = kbFeedbackSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    const article = await prisma.kbArticle.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        select: { id: true, status: true, visibility: true, authorId: true },
    })
    if (!article) return notFound("ไม่พบบทความที่ต้องการ")
    if (!canReadArticle(user, article)) return forbidden("คุณไม่มีสิทธิ์อ่านบทความนี้")

    try {
        // โหวตซ้ำได้ = เปลี่ยนใจได้ แต่ต้องไม่ทำให้ตัวนับเฟ้อ
        // จึงถอนโหวตเดิมออกจากตัวนับก่อนแล้วค่อยนับใหม่ ทั้งหมดอยู่ใน transaction เดียว
        const previous = await prisma.kbFeedback.findFirst({
            where: { articleId: article.id, userId: user.id },
            select: { id: true, isHelpful: true },
        })

        if (previous?.isHelpful === input.isHelpful && !input.comment) {
            return NextResponse.json({ ok: true, message: "บันทึกความเห็นของคุณไว้แล้ว" })
        }

        const [, updated] = await prisma.$transaction([
            previous
                ? prisma.kbFeedback.update({
                      where: { id: previous.id },
                      data: { isHelpful: input.isHelpful, comment: input.comment ?? null },
                  })
                : prisma.kbFeedback.create({
                      data: {
                          articleId: article.id,
                          userId: user.id,
                          isHelpful: input.isHelpful,
                          comment: input.comment ?? null,
                      },
                  }),
            prisma.kbArticle.update({
                where: { id: article.id },
                data: {
                    helpfulCount: {
                        increment:
                            (input.isHelpful ? 1 : 0) - (previous?.isHelpful === true ? 1 : 0),
                    },
                    notHelpfulCount: {
                        increment:
                            (input.isHelpful ? 0 : 1) - (previous?.isHelpful === false ? 1 : 0),
                    },
                },
                select: { helpfulCount: true, notHelpfulCount: true },
            }),
        ])

        return NextResponse.json({
            ok: true,
            helpfulCount: updated.helpfulCount,
            notHelpfulCount: updated.notHelpfulCount,
            message: "ขอบคุณสำหรับความเห็น",
        })
    } catch (error) {
        console.error("KB feedback Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกความเห็นได้" }, { status: 500 })
    }
}
