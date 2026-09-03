// app/api/assets/[id]/history/route.ts
// GET  — ประวัติการโอน/ซ่อม/คืน/จำหน่ายของครุภัณฑ์หนึ่งชิ้น (F7.4)
// POST — บันทึกการเคลื่อนไหวหนึ่งครั้ง แล้วปรับสถานะ/ผู้ครอบครองของทะเบียนตามการกระทำนั้น
//
// เส้นนี้เป็นทางหลักของการ "ทำอะไรกับของ" ส่วน PATCH ที่ตัวครุภัณฑ์ใช้แก้ข้อมูลทะเบียน
// เช่นชื่อหรือราคา — แยกกันเพื่อให้ประวัติเล่าเรื่องเป็นเหตุการณ์ ไม่ใช่การแก้ฟิลด์

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, STAFF_ROLES, MANAGER_ROLES } from "@/lib/rbac"
import { createAssetHistorySchema } from "@/lib/asset-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import {
    assetDetailSelect,
    assetHistorySelect,
    attachHistoryNames,
    recordAssetHistory,
    toAssetDto,
} from "@/lib/asset-service"
import { statusAfterAction, transitionError } from "@/lib/asset-workflow"

function whereIdOrCode(key: string) {
    return { OR: [{ id: key }, { assetCode: key }] }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response

    const { id } = await params

    try {
        const asset = await prisma.asset.findFirst({
            where: whereIdOrCode(id),
            select: { id: true },
        })
        if (!asset) return notFound("ไม่พบครุภัณฑ์ที่ต้องการ")

        const rows = await prisma.assetHistory.findMany({
            where: { assetId: asset.id },
            select: assetHistorySelect,
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ histories: await attachHistoryNames(rows) })
    } catch (error) {
        console.error("Asset history GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดประวัติครุภัณฑ์ได้" }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const parsed = createAssetHistorySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const asset = await prisma.asset.findFirst({
            where: whereIdOrCode(id),
            select: { id: true, status: true, custodianId: true },
        })
        if (!asset) return notFound("ไม่พบครุภัณฑ์ที่ต้องการ")

        // จ่ายของหรือโอนย้าย ต้องรู้ว่าให้ใคร
        const needsRecipient = input.action === "assign" || input.action === "transfer"
        if (needsRecipient && !input.toUserId) {
            return badRequest("กรุณาระบุผู้รับครุภัณฑ์")
        }

        if (input.toUserId) {
            const recipient = await prisma.user.findUnique({
                where: { id: input.toUserId },
                select: { id: true },
            })
            if (!recipient) return badRequest("ไม่พบผู้รับที่เลือก")
        }

        const nextStatus = statusAfterAction(input.action) ?? asset.status
        const error = transitionError(asset.status, nextStatus)
        if (error) return badRequest(error)

        // คืนคลังหรือจำหน่ายแล้วไม่มีผู้ครอบครองต่อ — ล้างช่องไว้ไม่ให้ทะเบียนชี้ผิดคน
        const nextCustodianId = needsRecipient ? (input.toUserId ?? null) : null

        const updated = await prisma.$transaction(async (tx) => {
            await recordAssetHistory(
                {
                    assetId: asset.id,
                    action: input.action,
                    actorId: user.id,
                    fromUserId: asset.custodianId,
                    toUserId: nextCustodianId,
                    note: input.note ?? null,
                },
                tx
            )

            return tx.asset.update({
                where: { id: asset.id },
                data: { status: nextStatus, custodianId: nextCustodianId },
                select: assetDetailSelect,
            })
        })

        return NextResponse.json({ asset: toAssetDto(updated) }, { status: 201 })
    } catch (error) {
        console.error("Asset history POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการเคลื่อนไหวได้" }, { status: 500 })
    }
}
