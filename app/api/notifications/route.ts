// app/api/notifications/route.ts
// GET — การแจ้งเตือนของผู้ที่ล็อกอิน + จำนวนที่ยังไม่อ่าน (F8.2)
//
// เปิดให้ทุก role ที่ล็อกอินแล้ว เพราะผู้แจ้งทั่วไปก็ต้องได้รับแจ้งความคืบหน้าของ Ticket ตัวเอง
// ทุก query ผูก `userId = me` เสมอ — ไม่มีใครเห็นการแจ้งเตือนของคนอื่น (NFR3)

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAuth, badRequest } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { listNotificationsQuerySchema } from "@/lib/notification-schema"

const notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    linkUrl: true,
    isRead: true,
    readAt: true,
    createdAt: true,
    deliveries: { select: { channel: true, status: true, error: true } },
} satisfies Prisma.NotificationSelect

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listNotificationsQuerySchema.safeParse(
        searchParamsToObject(new URL(request.url))
    )
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where: Prisma.NotificationWhereInput = {
        userId: user.id,
        ...(query.state === "unread" ? { isRead: false } : {}),
    }

    try {
        const [rows, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                select: notificationSelect,
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            prisma.notification.count({ where }),
            // นับที่ยังไม่อ่านจากทั้งหมดเสมอ ไม่ขึ้นกับตัวกรองที่เลือกอยู่ — ตัวเลขบนกระดิ่งจะได้นิ่ง
            prisma.notification.count({ where: { userId: user.id, isRead: false } }),
        ])

        return NextResponse.json({
            notifications: rows,
            unreadCount,
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("Notification GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดการแจ้งเตือนได้" }, { status: 500 })
    }
}
