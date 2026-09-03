// app/api/approvals/[id]/decide/route.ts
// POST — ผู้อนุมัติของขั้นที่รออยู่กดอนุมัติ / ไม่อนุมัติ พร้อมความเห็น (F7.12)
//
// ตรรกะการเดินขั้นอยู่ใน `resolveDecision()` — ที่นี่ทำหน้าที่ตรวจสิทธิ์ บันทึกผล
// และส่งแจ้งเตือนต่อ: ยังมีขั้นถัดไป → ปลุกผู้อนุมัติคนถัดไป · จบแล้ว → แจ้งผู้ขอ

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden, MANAGER_ROLES } from "@/lib/rbac"
import { decideApprovalSchema } from "@/lib/approval-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { approvalDetailSelect, decimalOrNull, toApprovalDto } from "@/lib/approval-service"
import { isCurrentApprover, resolveDecision } from "@/lib/approval-workflow"
import { notifyApprovalDecided, notifyApprovalPending } from "@/lib/approval-notify"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // สิทธิ์ `approval:approve` เป็นของ `manager` ขึ้นไปตาม §7
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = decideApprovalSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.approvalRequest.findFirst({
            where: { OR: [{ id }, { requestNo: id }] },
            select: approvalDetailSelect,
        })
        if (!current) return notFound("ไม่พบคำขอที่ต้องการ")

        // ต้องเป็นผู้อนุมัติของ "ขั้นที่รออยู่ตอนนี้" เท่านั้น — ขั้นถัดไปยังไม่ถึงคิว
        if (!isCurrentApprover(user.id, current, current.steps)) {
            return forbidden("คำขอนี้ไม่ได้รอการพิจารณาจากคุณ")
        }

        const step = current.steps.find(
            (s) => s.stepOrder === current.currentStep && s.status === "pending"
        )
        if (!step) return badRequest("ไม่พบขั้นการอนุมัติที่รอการพิจารณา")

        const outcome = resolveDecision(current.steps, step.stepOrder, input.approved)

        // ผลของขั้นกับสถานะของใบต้องเปลี่ยนพร้อมกัน ไม่งั้นใบจะค้างในสถานะที่อ่านแล้วสับสน
        const updated = await prisma.$transaction(async (tx) => {
            await tx.approvalStep.update({
                where: { id: step.id },
                data: {
                    status: input.approved ? "approved" : "rejected",
                    comment: input.comment ?? null,
                    decidedAt: new Date(),
                },
            })

            return tx.approvalRequest.update({
                where: { id: current.id },
                data: { status: outcome.status, currentStep: outcome.currentStep },
                select: approvalDetailSelect,
            })
        })

        const amount = decimalOrNull(current.amount)

        if (outcome.nextApproverId) {
            // ยังไม่จบ — ส่งต่อให้ผู้อนุมัติขั้นถัดไป และยังไม่ต้องรบกวนผู้ขอ
            void notifyApprovalPending(updated, {
                approverId: outcome.nextApproverId,
                stepOrder: outcome.currentStep,
                totalSteps: current.steps.length,
                amount,
                actorId: user.id,
            })
        } else {
            void notifyApprovalDecided(updated, {
                approved: input.approved,
                approverName: user.name,
                comment: input.comment ?? null,
                actorId: user.id,
            })
        }

        return NextResponse.json({
            request: toApprovalDto(updated),
            /// บอกหน้าจอว่าใบนี้จบแล้วหรือส่งต่อไปขั้นถัดไป
            finished: outcome.nextApproverId === null,
        })
    } catch (error) {
        console.error("Approval decide Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกผลการพิจารณาได้" }, { status: 500 })
    }
}
