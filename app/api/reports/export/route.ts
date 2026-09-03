// app/api/reports/export/route.ts
// GET — ส่งออกรายงานสรุปประจำเดือน / ไตรมาส เป็นไฟล์ Excel หลายชีต (F7.22)
//
// ใช้ query ชุดเดียวกับ `GET /api/reports/summary` และเรียก buildSummaryReport() ตัวเดียวกัน
// ตัวเลขในไฟล์จึงตรงกับที่เห็นบนหน้าจอเสมอ
//
// ส่งออกทั้งชุดเป็นสิทธิ์หัวหน้าขึ้นไป เหมือน export ครุภัณฑ์ (spec §7 — report:export)

import { NextRequest, NextResponse } from "next/server"
import { requireRole, badRequest, MANAGER_ROLES } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { reportPeriodQuerySchema, resolvePeriod } from "@/lib/report-schema"
import { buildSummaryReport } from "@/lib/report-service"
import { buildWorkbook } from "@/lib/report-export"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = reportPeriodQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    const period = resolvePeriod(parsed.data)
    if (!period) {
        return badRequest("ช่วงกำหนดเองต้องระบุวันที่เริ่มต้นและสิ้นสุด และเริ่มต้องไม่หลังสิ้นสุด")
    }

    try {
        const report = await buildSummaryReport(user, period)
        const buffer = await buildWorkbook(report).xlsx.writeBuffer()

        return new NextResponse(buffer as ArrayBuffer, {
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="report-${period.from}-${period.to}.xlsx"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        console.error("Summary Report export GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถส่งออกรายงานได้" }, { status: 500 })
    }
}
