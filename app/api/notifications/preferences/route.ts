// app/api/notifications/preferences/route.ts
// GET   — ช่องทางแจ้งเตือนที่ผู้ใช้เปิดไว้ + สถานะการผูกบัญชี LINE (F8.7)
// PATCH — บันทึกการเปิด/ปิดช่องทางของตัวเอง
//
// เป็นค่าของ "ตัวเอง" เสมอ ไม่มีพารามิเตอร์ให้ระบุผู้ใช้คนอื่น — แม้แต่ admin ก็ตั้งค่าแทนไม่ได้

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, badRequest } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updatePreferencesSchema } from "@/lib/notification-schema"
import { getNotificationPrefs, saveNotificationPrefs } from "@/lib/notification"

/// ผูก LINE ไว้แล้วหรือยัง — ถ้ายัง สวิตช์ LINE จะเปิดได้แต่ส่งไม่ถึง หน้าจอจึงต้องบอกผู้ใช้
async function isLineLinked(userId: string): Promise<boolean> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { lineUserId: true },
    })
    return Boolean(row?.lineUserId)
}

export async function GET() {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    try {
        const [prefs, lineLinked] = await Promise.all([
            getNotificationPrefs(user.id),
            isLineLinked(user.id),
        ])
        return NextResponse.json({ prefs, lineLinked })
    } catch (error) {
        console.error("Notification preferences GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดการตั้งค่าแจ้งเตือนได้" }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updatePreferencesSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    try {
        const prefs = await saveNotificationPrefs(user.id, parsed.data)
        const lineLinked = await isLineLinked(user.id)
        return NextResponse.json({ prefs, lineLinked })
    } catch (error) {
        console.error("Notification preferences PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการตั้งค่าแจ้งเตือนได้" }, { status: 500 })
    }
}
