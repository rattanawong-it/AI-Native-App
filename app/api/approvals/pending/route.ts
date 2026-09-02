// app/api/approvals/pending/route.ts
// GET — จำนวนและรายการคำขอที่รอ "ฉัน" ตัดสินใจอยู่ตอนนี้ (F7.12)
//
// แยกจาก `GET /api/approvals?scope=to-approve` เพื่อให้หน้าจอถามแค่ตัวเลขมาขึ้นป้ายบนเมนู
// ได้โดยไม่ต้องดึงรายการทั้งชุด — `?count=true` คืนเฉพาะจำนวน

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/rbac"
import { approvalListSelect, pendingForApproverWhere, toApprovalDto } from "@/lib/approval-service"

/// จำนวนใบสูงสุดที่ส่งกลับ — กล่อง "รออนุมัติ" ที่ยาวกว่านี้ควรไปดูในหน้ารายการเต็ม
const MAX_ITEMS = 20

export async function GET(request: NextRequest) {
    const guard = await requireRole(["manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const countOnly = new URL(request.url).searchParams.get("count") === "true"
    const where = pendingForApproverWhere(user.id)

    try {
        const total = await prisma.approvalRequest.count({ where })
        if (countOnly) return NextResponse.json({ total })

        const requests = await prisma.approvalRequest.findMany({
            where,
            select: approvalListSelect,
            orderBy: { createdAt: "asc" }, // ใบที่รอนานที่สุดขึ้นก่อน
            take: MAX_ITEMS,
        })

        return NextResponse.json({ total, requests: requests.map(toApprovalDto) })
    } catch (error) {
        console.error("Approval pending GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการรออนุมัติได้" }, { status: 500 })
    }
}
