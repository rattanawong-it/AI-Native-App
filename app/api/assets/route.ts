// app/api/assets/route.ts
// GET  — รายการครุภัณฑ์ พร้อมค้นหา / ฟิลเตอร์ / pagination (F7.1, F7.2)
// POST — เพิ่มครุภัณฑ์ใหม่ + ออกรหัสให้ถ้าไม่ได้กรอกมา + เปิดสมุดประวัติใบแรก (F7.1, F7.4)
// ผ่าน NFR1 (ตรวจ session) · NFR2 (zod) · NFR9 (pagination)
//
// สิทธิ์ตาม §7: `agent` อ่านได้อย่างเดียว · เพิ่ม/แก้/ลบ ต้อง `manager` ขึ้นไป

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { createAssetSchema, listAssetQuerySchema } from "@/lib/asset-schema"
import { searchParamsToObject, firstIssueMessage } from "@/lib/ticket-schema"
import {
    assetListSelect,
    buildAssetOrderBy,
    buildAssetWhere,
    nextAssetCode,
    recordAssetHistory,
    toAssetDto,
} from "@/lib/asset-service"
import { requiresCustodian } from "@/lib/asset-workflow"

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response

    const parsed = listAssetQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where = buildAssetWhere(query)

    try {
        const [total, assets] = await Promise.all([
            prisma.asset.count({ where }),
            prisma.asset.findMany({
                where,
                select: assetListSelect,
                orderBy: buildAssetOrderBy(query.sort),
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
        ])

        return NextResponse.json({
            assets: assets.map(toAssetDto),
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("Asset GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายการครุภัณฑ์ได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole(["manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createAssetSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    // สถานะ "ใช้งาน" ต้องรู้ว่าใครถืออยู่ ไม่งั้นทะเบียนจะตามของไม่เจอ
    if (requiresCustodian(input.status) && !input.custodianId) {
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

    try {
        const assetCode = input.assetCode ?? (await nextAssetCode())

        const duplicate = await prisma.asset.findUnique({
            where: { assetCode },
            select: { id: true },
        })
        if (duplicate) return badRequest(`รหัสครุภัณฑ์ "${assetCode}" ถูกใช้ไปแล้ว`)

        const asset = await prisma.asset.create({
            data: {
                assetCode,
                name: input.name,
                type: input.type,
                brand: input.brand ?? null,
                model: input.model ?? null,
                serialNumber: input.serialNumber ?? null,
                purchaseDate: input.purchaseDate ?? null,
                price: input.price ?? null,
                warrantyEndDate: input.warrantyEndDate ?? null,
                location: input.location ?? null,
                status: input.status,
                custodianId: input.custodianId ?? null,
                departmentId: input.departmentId ?? null,
                note: input.note ?? null,
            },
            select: assetListSelect,
        })

        // เปิดสมุดประวัติทันทีที่ขึ้นทะเบียน — ถ้าจ่ายให้ใครไปแล้วตั้งแต่ต้นก็บันทึกเป็นการจ่ายของ
        await recordAssetHistory({
            assetId: asset.id,
            action: input.custodianId ? "assign" : "register",
            actorId: user.id,
            toUserId: input.custodianId ?? null,
            note: input.custodianId ? "ขึ้นทะเบียนพร้อมผู้ครอบครอง" : "ขึ้นทะเบียนเข้าคลัง",
        })

        return NextResponse.json({ asset: toAssetDto(asset) }, { status: 201 })
    } catch (error) {
        console.error("Asset POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกครุภัณฑ์ได้" }, { status: 500 })
    }
}
