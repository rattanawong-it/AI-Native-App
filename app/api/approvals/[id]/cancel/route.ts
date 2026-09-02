// app/api/approvals/[id]/cancel/route.ts
// POST — ผู้ขอยกเลิกคำขอของตัวเองที่ยังไม่ได้ข้อยุติ (F7.11)
//
// ใบที่ยื่นไปแล้วห้ามลบทิ้ง เพราะเป็นหลักฐานว่าเคยมีการขอ — ปิดด้วยการยกเลิกแทน
// เหตุผลที่กรอกจะถูกต่อท้ายรายละเอียด เพื่อให้คนที่เปิดดูย้อนหลังรู้ว่าทำไมถึงยกเลิก

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden } from "@/lib/rbac"
import { cancelApprovalSchema } from "@/lib/approval-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { approvalDetailSelect, canCancelRequest, toApprovalDto } from "@/lib/approval-service"
import { transitionError } from "@/lib/approval-workflow"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    // เหตุผลไม่บังคับ — ส่ง body ว่างมาก็ยกเลิกได้
    let body: unknown = {}
    try {
        body = await request.json()
    } catch {
        body = {}
    }

    const parsed = cancelApprovalSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const { reason } = parsed.data

    try {
        const current = await prisma.approvalRequest.findFirst({
            where: { OR: [{ id }, { requestNo: id }] },
            select: { id: true, requesterId: true, status: true, description: true },
        })
        if (!current) return notFound("ไม่พบคำขอที่ต้องการ")

        if (!canCancelRequest(user, current)) {
            return forbidden("ยกเลิกได้เฉพาะคำขอของตัวเองที่ยังไม่ได้ข้อยุติ")
        }

        const error = transitionError(current.status, "cancelled")
        if (error) return badRequest(error)

        const description = reason
            ? [current.description, `— ยกเลิกเมื่อ: ${reason}`].filter(Boolean).join("\n\n")
            : current.description

        const updated = await prisma.$transaction(async (tx) => {
            // ขั้นที่ยังรออยู่ไม่ต้องค้างในกล่อง "รออนุมัติของฉัน" ของใครอีก
            await tx.approvalStep.updateMany({
                where: { requestId: current.id, status: "pending" },
                data: { status: "rejected", comment: "คำขอถูกยกเลิกโดยผู้ขอ" },
            })

            return tx.approvalRequest.update({
                where: { id: current.id },
                data: { status: "cancelled", description },
                select: approvalDetailSelect,
            })
        })

        return NextResponse.json({ request: toApprovalDto(updated) })
    } catch (error) {
        console.error("Approval cancel Error:", error)
        return NextResponse.json({ error: "ไม่สามารถยกเลิกคำขอได้" }, { status: 500 })
    }
}
