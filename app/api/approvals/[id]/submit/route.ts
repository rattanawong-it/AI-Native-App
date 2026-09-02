// app/api/approvals/[id]/submit/route.ts
// POST — ยื่นคำขอฉบับร่างเข้าสู่การอนุมัติ แล้วปลุกผู้อนุมัติขั้นแรก (F7.11, F8.6)
//
// แยกจาก PATCH เพราะการยื่นเป็นการ "เปลี่ยนสถานะ" ไม่ใช่การแก้เนื้อหา —
// เส้นเดียวที่พาใบคำขอจากฉบับร่างไปสู่การอนุมัติ จึงมั่นใจได้ว่าแจ้งเตือนออกทุกครั้ง

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden } from "@/lib/rbac"
import { approvalListSelect, decimalOrNull, toApprovalDto } from "@/lib/approval-service"
import { transitionError } from "@/lib/approval-workflow"
import { notifyApprovalPending } from "@/lib/approval-notify"

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    try {
        const current = await prisma.approvalRequest.findFirst({
            where: { OR: [{ id }, { requestNo: id }] },
            select: approvalListSelect,
        })
        if (!current) return notFound("ไม่พบคำขอที่ต้องการ")

        if (current.requesterId !== user.id && !user.roles.includes("admin")) {
            return forbidden("ยื่นได้เฉพาะคำขอของตัวเอง")
        }

        const error = transitionError(current.status, "pending")
        if (error) return badRequest(error)

        if (current.steps.length === 0) {
            return badRequest("กรุณากำหนดผู้อนุมัติอย่างน้อย 1 คนก่อนยื่นคำขอ")
        }

        const firstStep = current.steps[0]

        const updated = await prisma.approvalRequest.update({
            where: { id: current.id },
            data: { status: "pending", currentStep: firstStep.stepOrder },
            select: approvalListSelect,
        })

        void notifyApprovalPending(updated, {
            approverId: firstStep.approverId,
            stepOrder: firstStep.stepOrder,
            totalSteps: current.steps.length,
            amount: decimalOrNull(current.amount),
            actorId: user.id,
        })

        return NextResponse.json({ request: toApprovalDto(updated) })
    } catch (error) {
        console.error("Approval submit Error:", error)
        return NextResponse.json({ error: "ไม่สามารถยื่นคำขอได้" }, { status: 500 })
    }
}
