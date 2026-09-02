// app/api/notifications/read-all/route.ts
// POST — ทำเครื่องหมายว่าอ่านแล้วทั้งหมด (F8.2)
//
// แยกเป็นเส้นของตัวเองแทนการวนเรียก PATCH ทีละใบ เพราะกระดิ่งที่ค้างหลายสิบรายการ
// จะกลายเป็นการยิง API หลายสิบครั้งพร้อมกัน

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/rbac"

export async function POST() {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    try {
        const result = await prisma.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true, readAt: new Date() },
        })

        return NextResponse.json({ updated: result.count, unreadCount: 0 })
    } catch (error) {
        console.error("Notification read-all Error:", error)
        return NextResponse.json({ error: "ไม่สามารถอัปเดตการแจ้งเตือนได้" }, { status: 500 })
    }
}
