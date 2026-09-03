// app/api/assets/[id]/route.ts
// GET    — รายละเอียดครุภัณฑ์หนึ่งชิ้น (รับได้ทั้ง id และรหัสครุภัณฑ์)
// PATCH  — แก้ไขข้อมูล + บันทึกประวัติอัตโนมัติเมื่อสถานะหรือผู้ครอบครองเปลี่ยน (F7.1, F7.4)
// DELETE — ลบออกจากทะเบียน (ประวัติถูกลบตาม onDelete: Cascade)
// ผ่าน NFR1 · NFR2 · NFR7 (บันทึกร่องรอยทุกการเปลี่ยนมือ/เปลี่ยนสถานะ)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, STAFF_ROLES, MANAGER_ROLES } from "@/lib/rbac"
import { updateAssetSchema } from "@/lib/asset-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { assetDetailSelect, recordAssetHistory, toAssetDto } from "@/lib/asset-service"
import {
    requiresCustodian,
    transitionError,
    type AssetHistoryAction,
} from "@/lib/asset-workflow"

/// รับได้ทั้ง id และรหัสครุภัณฑ์ — หน้าพิมพ์ป้าย QR สแกนแล้วได้รหัส ไม่ใช่ id
function whereIdOrCode(key: string) {
    return { OR: [{ id: key }, { assetCode: key }] }
}

/// การเปลี่ยนแปลงครั้งนี้ควรถูกบันทึกเป็นประวัติชนิดใด — `null` เมื่อไม่ได้แตะสถานะหรือผู้ครอบครอง
function historyActionFor(
    before: { status: string; custodianId: string | null },
    after: { status: string; custodianId: string | null }
): AssetHistoryAction | null {
    if (before.status !== after.status) {
        if (after.status === "repair") return "repair"
        if (after.status === "disposed") return "dispose"
        if (after.status === "in_stock") return "return"
        if (after.status === "in_use") return "assign"
    }

    // สถานะเดิมแต่เปลี่ยนมือ = โอนย้ายให้คนใหม่
    if (before.custodianId !== after.custodianId) {
        return after.custodianId ? "transfer" : "return"
    }

    return null
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
            select: assetDetailSelect,
        })
        if (!asset) return notFound("ไม่พบครุภัณฑ์ที่ต้องการ")

        return NextResponse.json({ asset: toAssetDto(asset) })
    } catch (error) {
        console.error("Asset detail GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลครุภัณฑ์ได้" }, { status: 500 })
    }
}

export async function PATCH(
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

    const parsed = updateAssetSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.asset.findFirst({
            where: whereIdOrCode(id),
            select: { id: true, assetCode: true, status: true, custodianId: true },
        })
        if (!current) return notFound("ไม่พบครุภัณฑ์ที่ต้องการ")

        const nextStatus = input.status ?? current.status
        const nextCustodianId =
            input.custodianId === undefined ? current.custodianId : (input.custodianId ?? null)

        if (input.status) {
            const error = transitionError(current.status, input.status)
            if (error) return badRequest(error)
        }

        if (requiresCustodian(nextStatus) && !nextCustodianId) {
            return badRequest('สถานะ "ใช้งาน" ต้องระบุผู้ครอบครอง')
        }

        if (input.custodianId) {
            const custodian = await prisma.user.findUnique({
                where: { id: input.custodianId },
                select: { id: true },
            })
            if (!custodian) return badRequest("ไม่พบผู้ครอบครองที่เลือก")
        }

        if (input.departmentId) {
            const department = await prisma.department.findFirst({
                where: { id: input.departmentId, active: true },
                select: { id: true },
            })
            if (!department) return badRequest("ไม่พบหน่วยงานที่เลือก")
        }

        if (input.assetCode && input.assetCode !== current.assetCode) {
            const duplicate = await prisma.asset.findUnique({
                where: { assetCode: input.assetCode },
                select: { id: true },
            })
            if (duplicate) return badRequest(`รหัสครุภัณฑ์ "${input.assetCode}" ถูกใช้ไปแล้ว`)
        }

        const action = historyActionFor(current, {
            status: nextStatus,
            custodianId: nextCustodianId,
        })

        // แก้ตัวทะเบียนกับบันทึกประวัติต้องสำเร็จหรือล้มไปด้วยกัน ไม่งั้นประวัติจะเล่าเรื่องผิด
        const asset = await prisma.$transaction(async (tx) => {
            const updated = await tx.asset.update({
                where: { id: current.id },
                data: {
                    ...(input.assetCode !== undefined ? { assetCode: input.assetCode } : {}),
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.type !== undefined ? { type: input.type } : {}),
                    ...(input.brand !== undefined ? { brand: input.brand } : {}),
                    ...(input.model !== undefined ? { model: input.model } : {}),
                    ...(input.serialNumber !== undefined
                        ? { serialNumber: input.serialNumber }
                        : {}),
                    ...(input.purchaseDate !== undefined
                        ? { purchaseDate: input.purchaseDate }
                        : {}),
                    ...(input.price !== undefined ? { price: input.price } : {}),
                    ...(input.warrantyEndDate !== undefined
                        ? { warrantyEndDate: input.warrantyEndDate }
                        : {}),
                    ...(input.location !== undefined ? { location: input.location } : {}),
                    ...(input.status !== undefined ? { status: input.status } : {}),
                    ...(input.custodianId !== undefined
                        ? { custodianId: input.custodianId ?? null }
                        : {}),
                    ...(input.departmentId !== undefined
                        ? { departmentId: input.departmentId ?? null }
                        : {}),
                    ...(input.note !== undefined ? { note: input.note } : {}),
                },
                select: assetDetailSelect,
            })

            if (action) {
                await recordAssetHistory(
                    {
                        assetId: current.id,
                        action,
                        actorId: user.id,
                        fromUserId: current.custodianId,
                        toUserId: nextCustodianId,
                    },
                    tx
                )
            }

            return updated
        })

        return NextResponse.json({ asset: toAssetDto(asset) })
    } catch (error) {
        console.error("Asset PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกการแก้ไขได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response

    const { id } = await params

    try {
        const asset = await prisma.asset.findFirst({
            where: whereIdOrCode(id),
            select: { id: true },
        })
        if (!asset) return notFound("ไม่พบครุภัณฑ์ที่ต้องการ")

        await prisma.asset.delete({ where: { id: asset.id } })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Asset DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบครุภัณฑ์ได้" }, { status: 500 })
    }
}
