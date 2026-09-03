// app/api/reports/summary/route.ts
// GET — รายงานสรุปประจำเดือน / ไตรมาส / ช่วงกำหนดเอง (F7.15, F7.16, F7.19, F7.20, F7.21)
//
// รวมทุกส่วนของรายงานไว้ในคำตอบเดียว เพราะหน้ารายงานแสดงพร้อมกันหมดและต้องส่งออกเป็นชุดเดียว
// การคิดตัวเลขทั้งหมดอยู่ใน lib/report-service.ts (ที่เดียว) เพื่อให้หน้าจอ, Excel และ
// Snapshot ได้ตัวเลขชุดเดียวกันเสมอ
//
// สิทธิ์ตาม spec §7 (รายงาน/Dashboard รวม): agent เห็นเฉพาะงานของตัวเอง · manager/admin เห็นทั้งศูนย์

import { NextRequest, NextResponse } from "next/server"
import { requireRole, badRequest } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { reportPeriodQuerySchema, resolvePeriod } from "@/lib/report-schema"
import { buildSummaryReport } from "@/lib/report-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
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
        return NextResponse.json({ report })
    } catch (error) {
        console.error("Summary Report GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถออกรายงานสรุปได้" }, { status: 500 })
    }
}
