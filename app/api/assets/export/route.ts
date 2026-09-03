// app/api/assets/export/route.ts
// GET — ส่งออกทะเบียนครุภัณฑ์เป็นไฟล์ CSV ตามเงื่อนไขค้นหาเดียวกับหน้ารายการ (F7.7)
//
// ใช้ query string ชุดเดียวกับ `GET /api/assets` ต่างกันแค่ไม่แบ่งหน้า — สิ่งที่เห็นบนจอ
// กับสิ่งที่ได้ในไฟล์จึงตรงกันเสมอ

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, MANAGER_ROLES } from "@/lib/rbac"
import { listAssetQuerySchema } from "@/lib/asset-schema"
import { searchParamsToObject, firstIssueMessage } from "@/lib/ticket-schema"
import {
    assetListSelect,
    buildAssetOrderBy,
    buildAssetWhere,
    toAssetCsv,
} from "@/lib/asset-service"

/// เพดานจำนวนแถวต่อไฟล์ — กันคำขอเดียวลากทั้งตารางจนหน่วยความจำบวม
const MAX_ROWS = 5000

export async function GET(request: NextRequest) {
    // ส่งออกข้อมูลทั้งชุดต้องมีสิทธิ์ `report:export` ตาม §7 — `agent` จึงยังทำไม่ได้
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response

    const parsed = listAssetQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    try {
        const assets = await prisma.asset.findMany({
            where: buildAssetWhere(query),
            select: assetListSelect,
            orderBy: buildAssetOrderBy(query.sort),
            take: MAX_ROWS,
        })

        const filename = `assets-${new Date().toISOString().slice(0, 10)}.csv`

        return new NextResponse(toAssetCsv(assets), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        })
    } catch (error) {
        console.error("Asset export Error:", error)
        return NextResponse.json({ error: "ไม่สามารถส่งออกไฟล์ได้" }, { status: 500 })
    }
}
