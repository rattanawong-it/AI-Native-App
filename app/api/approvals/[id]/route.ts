// app/api/approvals/[id]/route.ts
// GET    — รายละเอียดคำขอ + ขั้นการอนุมัติ + timeline (F7.8, F7.14)
// PATCH  — แก้ไขคำขอ ทำได้เฉพาะตอนที่ยังไม่เข้าสู่การอนุมัติ (F7.11)
// DELETE — ลบคำขอฉบับร่างของตัวเอง (ขั้นการอนุมัติถูกลบตาม onDelete: Cascade)
// ผ่าน NFR1 · NFR2 · NFR3 (ตรวจสิทธิ์ระดับแถวทั้งตอนอ่านและตอนแก้)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, forbidden, STAFF_ROLES } from "@/lib/rbac"
import { updateApprovalSchema } from "@/lib/approval-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import {
    approvalDetailSelect,
    buildTimeline,
    canEditRequest,
    canReadRequest,
    toApprovalDto,
    validateApprovers,
} from "@/lib/approval-service"
import { isCurrentApprover } from "@/lib/approval-workflow"

/// รับได้ทั้ง id และเลขที่คำขอ (RQ-256909-0001) — ลิงก์ในอีเมลใช้ id ส่วนคนพิมพ์มักใช้เลขที่
function whereIdOrNo(key: string) {
    return { OR: [{ id: key }, { requestNo: key }] }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    try {
        const found = await prisma.approvalRequest.findFirst({
            where: whereIdOrNo(id),
            select: approvalDetailSelect,
        })
        if (!found) return notFound("ไม่พบคำขอที่ต้องการ")
        if (!canReadRequest(user, found)) return forbidden("คุณไม่มีสิทธิ์ดูคำขอนี้")

        return NextResponse.json({
            request: toApprovalDto(found),
            timeline: buildTimeline(found),
            // หน้าจอใช้ค่านี้ตัดสินว่าจะโชว์ปุ่มอนุมัติ/ไม่อนุมัติไหม (F7.12)
            canDecide: isCurrentApprover(user.id, found, found.steps),
            canEdit: canEditRequest(user, found),
        })
    } catch (error) {
        console.error("Approval detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดคำขอได้" }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateApprovalSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.approvalRequest.findFirst({
            where: whereIdOrNo(id),
            select: { id: true, requesterId: true, status: true },
        })
        if (!current) return notFound("ไม่พบคำขอที่ต้องการ")

        if (!canEditRequest(user, current)) {
            return forbidden("แก้ไขได้เฉพาะคำขอของตัวเองที่ยังไม่เข้าสู่การอนุมัติ")
        }

        if (input.approverIds) {
            const approverError = await validateApprovers(input.approverIds)
            if (approverError) return badRequest(approverError)
        }

        const updated = await prisma.$transaction(async (tx) => {
            if (input.approverIds) {
                // เปลี่ยนลำดับผู้อนุมัติ = ล้างของเดิมแล้วสร้างใหม่ทั้งชุด
                // ทำได้เพราะสถานะยังไม่เข้าสู่การอนุมัติ จึงไม่มีขั้นไหนถูกตัดสินไปแล้ว
                await tx.approvalStep.deleteMany({ where: { requestId: current.id } })
                await tx.approvalStep.createMany({
                    data: input.approverIds.map((approverId, index) => ({
                        requestId: current.id,
                        stepOrder: index + 1,
                        approverId,
                    })),
                })
            }

            return tx.approvalRequest.update({
                where: { id: current.id },
                data: {
                    ...(input.type !== undefined ? { type: input.type } : {}),
                    ...(input.title !== undefined ? { title: input.title } : {}),
                    ...(input.description !== undefined
                        ? { description: input.description }
                        : {}),
                    ...(input.amount !== undefined ? { amount: input.amount } : {}),
                    ...(input.approverIds ? { currentStep: 1 } : {}),
                },
                select: approvalDetailSelect,
            })
        })

        return NextResponse.json({ request: toApprovalDto(updated) })
    } catch (error) {
        console.error("Approval PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไขได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const { id } = await params

    try {
        const current = await prisma.approvalRequest.findFirst({
            where: whereIdOrNo(id),
            select: { id: true, requesterId: true, status: true },
        })
        if (!current) return notFound("ไม่พบคำขอที่ต้องการ")

        // ใบที่เคยเข้าสู่การอนุมัติแล้วต้องเก็บไว้เป็นหลักฐาน — ให้ยกเลิกแทนการลบ
        if (current.status !== "draft") {
            return badRequest("ลบได้เฉพาะคำขอฉบับร่าง — คำขอที่ยื่นแล้วให้ใช้การยกเลิกแทน")
        }
        if (current.requesterId !== user.id && !user.roles.includes("admin")) {
            return forbidden("ลบได้เฉพาะคำขอของตัวเอง")
        }

        await prisma.approvalRequest.delete({ where: { id: current.id } })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Approval DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบคำขอได้" }, { status: 500 })
    }
}
