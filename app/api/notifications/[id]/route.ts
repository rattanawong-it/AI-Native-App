// app/api/notifications/[id]/route.ts
// PATCH — ทำเครื่องหมายอ่านแล้ว / ยังไม่อ่าน (F8.2)
//
// เจ้าของการแจ้งเตือนเท่านั้นที่แตะได้ (NFR3)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, badRequest, notFound, forbidden } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateNotificationSchema } from "@/lib/notification-schema"

export async function PATCH(
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

    const parsed = updateNotificationSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const { isRead } = parsed.data

    try {
        const current = await prisma.notification.findUnique({
            where: { id },
            select: { id: true, userId: true },
        })
        if (!current) return notFound("ไม่พบการแจ้งเตือนที่ต้องการ")
        if (current.userId !== user.id) return forbidden("แตะได้เฉพาะการแจ้งเตือนของตัวเอง")

        const notification = await prisma.notification.update({
            where: { id },
            data: { isRead, readAt: isRead ? new Date() : null },
            select: { id: true, isRead: true, readAt: true },
        })

        const unreadCount = await prisma.notification.count({
            where: { userId: user.id, isRead: false },
        })

        return NextResponse.json({ notification, unreadCount })
    } catch (error) {
        console.error("Notification PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถอัปเดตการแจ้งเตือนได้" }, { status: 500 })
    }
}
