// app/api/assets/import/route.ts
// POST — นำเข้าทะเบียนครุภัณฑ์จากไฟล์ CSV (F7.7)
//
// รับเนื้อไฟล์เป็นข้อความใน JSON ไม่ใช่ multipart เพราะระบบยังไม่มีที่เก็บไฟล์ (ดู F1.7)
// และไฟล์ CSV ของทะเบียนครุภัณฑ์เป็นข้อความล้วนอยู่แล้ว
//
// `dryRun: true` = ตรวจอย่างเดียวไม่บันทึก ให้ผู้ใช้เห็นว่าแถวไหนจะพลาดก่อนลงมือจริง
// แถวที่ผิดจะถูกข้ามและรายงานกลับไปทีละแถว — ไม่ล้มทั้งไฟล์เพราะพิมพ์ผิดแถวเดียว

import { NextRequest, NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { importAssetRowSchema, importAssetSchema } from "@/lib/asset-schema"
import { firstIssueMessage } from "@/lib/ticket-schema"
import {
    CSV_HEADER_MAP,
    nextAssetCode,
    parseDateCell,
    parseNumberCell,
    parseStatusCell,
    parseTypeCell,
    recordAssetHistory,
} from "@/lib/asset-service"

/// จำนวนแถวสูงสุดต่อไฟล์ — ไฟล์ที่ใหญ่กว่านี้ควรแบ่งนำเข้าเป็นรอบ
const MAX_ROWS = 2000

interface RowError {
    /// เลขบรรทัดในไฟล์ตามที่ผู้ใช้เห็นใน Excel (นับหัวตารางเป็นบรรทัดที่ 1)
    line: number
    message: string
}

/// เปลี่ยนหัวคอลัมน์ไทย/อังกฤษเป็นชื่อฟิลด์ในระบบ และทิ้งคอลัมน์ที่ไม่รู้จัก
function normalizeRow(raw: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [header, value] of Object.entries(raw)) {
        const field = CSV_HEADER_MAP[header.trim()]
        if (field) out[field] = value
    }
    return out
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

    const parsed = importAssetSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const { csv, dryRun } = parsed.data

    let records: Record<string, string>[]
    try {
        records = parse(csv, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true,
        })
    } catch (error) {
        console.error("Asset import parse Error:", error)
        return badRequest("อ่านไฟล์ CSV ไม่สำเร็จ — ตรวจสอบว่าไฟล์มีหัวตารางและคั่นด้วยเครื่องหมายจุลภาค")
    }

    if (records.length === 0) return badRequest("ไฟล์ CSV ไม่มีข้อมูล")
    if (records.length > MAX_ROWS) {
        return badRequest(`ไฟล์มี ${records.length} แถว เกินเพดาน ${MAX_ROWS} แถวต่อครั้ง`)
    }

    const errors: RowError[] = []
    let created = 0
    let updated = 0

    try {
        for (const [index, raw] of records.entries()) {
            const line = index + 2 // +1 ข้ามหัวตาราง, +1 เพราะ Excel นับจาก 1
            const row = importAssetRowSchema.safeParse(normalizeRow(raw))
            if (!row.success) {
                errors.push({ line, message: firstIssueMessage(row.error) })
                continue
            }

            const input = row.data
            const type = parseTypeCell(input.type)
            if (input.type && !type) {
                errors.push({ line, message: `ไม่รู้จักประเภท "${input.type}"` })
                continue
            }

            const status = parseStatusCell(input.status)
            if (input.status && !status) {
                errors.push({ line, message: `ไม่รู้จักสถานะ "${input.status}"` })
                continue
            }

            const data = {
                name: input.name,
                type: type ?? "other",
                brand: input.brand || null,
                model: input.model || null,
                serialNumber: input.serialNumber || null,
                purchaseDate: parseDateCell(input.purchaseDate),
                price: parseNumberCell(input.price),
                warrantyEndDate: parseDateCell(input.warrantyEndDate),
                location: input.location || null,
                // ไฟล์นำเข้าไม่มีคอลัมน์ผู้ครอบครอง จึงลงเป็นของในคลังไว้ก่อน
                // แล้วค่อยจ่ายออกผ่านหน้าจอเพื่อให้มีประวัติการจ่ายของจริง
                status: status ?? "in_stock",
                note: input.note || null,
            }

            // มีรหัสเดิมอยู่แล้ว = อัปเดตทับ · ไม่มี = เพิ่มใหม่ (ให้ไฟล์เดียวใช้ซ้ำได้)
            const existing = input.assetCode
                ? await prisma.asset.findUnique({
                      where: { assetCode: input.assetCode },
                      select: { id: true },
                  })
                : null

            if (existing) {
                if (!dryRun) {
                    await prisma.asset.update({ where: { id: existing.id }, data })
                }
                updated += 1
                continue
            }

            if (!dryRun) {
                const assetCode = input.assetCode || (await nextAssetCode())
                const asset = await prisma.asset.create({
                    data: { ...data, assetCode },
                    select: { id: true },
                })
                await recordAssetHistory({
                    assetId: asset.id,
                    action: "return",
                    actorId: user.id,
                    note: "ขึ้นทะเบียนจากการนำเข้าไฟล์ CSV",
                })
            }
            created += 1
        }

        return NextResponse.json({
            dryRun,
            total: records.length,
            created,
            updated,
            failed: errors.length,
            errors,
        })
    } catch (error) {
        console.error("Asset import Error:", error)
        return NextResponse.json({ error: "นำเข้าข้อมูลไม่สำเร็จ" }, { status: 500 })
    }
}
