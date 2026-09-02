// app/api/line/link/route.ts
// GET    — สถานะการผูกบัญชี LINE ของตัวเอง
// POST   — ขอรหัสผูกบัญชี (ใช้ครั้งเดียว หมดอายุใน 10 นาที)
// DELETE — ยกเลิกการผูก
//
// เป็นของ "ตัวเอง" เสมอ — ไม่มีพารามิเตอร์ให้ระบุผู้ใช้คนอื่น
// อ้างอิง docs/spec.md §8 ⑧ F8.5 และ §8 ① F1.9

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/rbac"
import { issueBindCode, unlinkLine } from "@/lib/line-link"

export async function GET() {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    try {
        const row = await prisma.user.findUnique({
            where: { id: user.id },
            select: { lineUserId: true },
        })
        return NextResponse.json({ linked: Boolean(row?.lineUserId) })
    } catch (error) {
        console.error("LINE link GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถตรวจสอบการผูกบัญชีได้" }, { status: 500 })
    }
}

export async function POST() {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    try {
        const { code, expiresAt } = await issueBindCode(user.id)
        return NextResponse.json({
            code,
            expiresAt,
            // บอกวิธีใช้กลับไปด้วย หน้าจอจะได้ไม่ต้องเขียนคำสั่งซ้ำเอง
            instruction: `เปิดแชทกับบอทใน LINE แล้วพิมพ์: ผูกบัญชี ${code}`,
        })
    } catch (error) {
        console.error("LINE link POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถออกรหัสผูกบัญชีได้" }, { status: 500 })
    }
}

export async function DELETE() {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    try {
        await unlinkLine(user.id)
        return NextResponse.json({ linked: false })
    } catch (error) {
        console.error("LINE link DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถยกเลิกการผูกบัญชีได้" }, { status: 500 })
    }
}
