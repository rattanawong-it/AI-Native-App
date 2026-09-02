// app/api/approvals/route.ts
// GET  — รายการคำขออนุมัติ พร้อมฟิลเตอร์ + ขอบเขต "ของฉัน / รอฉันอนุมัติ" (F7.8, F7.12)
// POST — สร้างคำขอ + กำหนดผู้อนุมัติตามลำดับขั้น และยื่นทันทีได้ถ้าต้องการ (F7.8–F7.11)
// ผ่าน NFR1 · NFR2 · NFR3 (ผู้ขอเห็นเฉพาะใบของตัวเองและใบที่ตัวเองเป็นผู้อนุมัติ) · NFR9

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { createApprovalSchema, listApprovalQuerySchema } from "@/lib/approval-schema"
import { searchParamsToObject, firstIssueMessage } from "@/lib/ticket-schema"
import {
    approvalListSelect,
    buildApprovalOrderBy,
    buildApprovalWhere,
    toApprovalDto,
    validateApprovers,
} from "@/lib/approval-service"
import { createWithRunningNumber, nextRequestNo } from "@/lib/running-number"
import { notifyApprovalPending } from "@/lib/approval-notify"

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listApprovalQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where = buildApprovalWhere(query, user)

    try {
        const [total, requests] = await Promise.all([
            prisma.approvalRequest.count({ where }),
            prisma.approvalRequest.findMany({
                where,
                select: approvalListSelect,
                orderBy: buildApprovalOrderBy(query.sort),
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
        ])

        return NextResponse.json({
            requests: requests.map(toApprovalDto),
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("Approval GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการคำขอได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createApprovalSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    const approverError = await validateApprovers(input.approverIds)
    if (approverError) return badRequest(approverError)

    try {
        const created = await createWithRunningNumber(nextRequestNo, (requestNo) =>
            prisma.approvalRequest.create({
                data: {
                    requestNo,
                    type: input.type,
                    title: input.title,
                    description: input.description ?? null,
                    amount: input.amount ?? null,
                    requesterId: user.id,
                    status: input.submit ? "pending" : "draft",
                    currentStep: 1,
                    steps: {
                        create: input.approverIds.map((approverId, index) => ({
                            stepOrder: index + 1,
                            approverId,
                        })),
                    },
                },
                select: approvalListSelect,
            })
        )

        // ยื่นทันที = ปลุกผู้อนุมัติขั้นแรกให้รู้ตัว (ยิงแล้วไม่รอ — หน้าจอไม่ควรค้างรออีเมล)
        if (input.submit) {
            void notifyApprovalPending(created, {
                approverId: input.approverIds[0],
                stepOrder: 1,
                totalSteps: input.approverIds.length,
                amount: input.amount ?? null,
                actorId: user.id,
            })
        }

        return NextResponse.json({ request: toApprovalDto(created) }, { status: 201 })
    } catch (error) {
        console.error("Approval POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกคำขอได้" }, { status: 500 })
    }
}
