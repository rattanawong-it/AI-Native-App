// app/api/notifications/retry/route.ts
// GET  — สรุปจำนวนรายการส่งที่ล้มเหลว แยกตามช่องทาง (F8.8)
// POST — สั่งส่งซ้ำเฉพาะรายการที่ล้มเหลว
//
// admin เท่านั้น — การกดปุ่มนี้ทำให้ระบบยิงอีเมล/LINE จริงหลายฉบับในครั้งเดียว

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { retryDeliveriesSchema } from "@/lib/notification-schema"
import { retryFailedDeliveries } from "@/lib/notification"

export async function GET() {
    const guard = await requireRole(["admin"])
    if (!guard.ok) return guard.response

    try {
        const grouped = await prisma.notificationDelivery.groupBy({
            by: ["channel", "status"],
            _count: { _all: true },
        })

        const failed = grouped
            .filter((g) => g.status === "failed")
            .map((g) => ({ channel: g.channel, count: g._count._all }))

        return NextResponse.json({
            failed,
            totalFailed: failed.reduce((sum, f) => sum + f.count, 0),
            byStatus: grouped.map((g) => ({
                channel: g.channel,
                status: g.status,
                count: g._count._all,
            })),
        })
    } catch (error) {
        console.error("Notification retry GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดสถานะการส่งได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole(["admin"])
    if (!guard.ok) return guard.response

    // ไม่ส่ง body มาก็ได้ — ใช้ค่าเริ่มต้น 50 รายการ
    let body: unknown = {}
    try {
        body = await request.json()
    } catch {
        body = {}
    }

    const parsed = retryDeliveriesSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    try {
        const result = await retryFailedDeliveries(parsed.data.limit)
        return NextResponse.json(result)
    } catch (error) {
        console.error("Notification retry POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถส่งซ้ำได้" }, { status: 500 })
    }
}
