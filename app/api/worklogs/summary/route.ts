// app/api/worklogs/summary/route.ts
// GET — สรุปชั่วโมงทำงานรายวัน / สัปดาห์ / เดือน (F3.7) และภาระงานรายคนของทีม (F3.8)
//
// scope=own   → ของผู้ที่ล็อกอิน (agent ขึ้นไป)
// scope=team  → รายคนทั้งระบบ (หัวหน้าขึ้นไปเท่านั้น ตาม spec §7 "รายงานภาระงาน")
//
// รวมยอดด้วย `groupBy` ของ Prisma ไม่ได้ดึงทุกแถวมานับในหน่วยความจำ — ต่างจากรายงาน SLA
// ที่ต้องตัดสินผลรายใบก่อน จึงไม่มีเพดานจำนวนแถวที่นี่

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, isManager, STAFF_ROLES } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { WORKLOG_REF_LABEL, workLogSummaryQuerySchema, type WorkLogRefType } from "@/lib/worklog-schema"
import { decimalToNumber, daysInRange, roundHours, summaryRange } from "@/lib/worklog-service"
import { utcDate } from "@/lib/sla-service"
import { thaiToday } from "@/lib/thai-date"
import { shortThaiDay } from "@/lib/worklog-types"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = workLogSummaryQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    if (query.scope === "team" && !isManager(user)) {
        return forbidden("ดูภาระงานของทีมได้เฉพาะหัวหน้าขึ้นไป")
    }

    const range = summaryRange(query.date ?? thaiToday(), query.period)
    const where: Prisma.WorkLogWhereInput = {
        workDate: { gte: utcDate(range.from), lte: utcDate(range.to) },
        ...(query.scope === "own" ? { userId: user.id } : {}),
    }

    try {
        const [byDayRaw, byRefRaw] = await Promise.all([
            prisma.workLog.groupBy({
                by: ["workDate"],
                where,
                _sum: { hours: true },
                _count: { _all: true },
            }),
            prisma.workLog.groupBy({
                by: ["refType"],
                where,
                _sum: { hours: true },
                _count: { _all: true },
            }),
        ])

        const byUserRaw =
            query.scope === "team"
                ? await prisma.workLog.groupBy({
                      by: ["userId"],
                      where,
                      _sum: { hours: true },
                      _count: { _all: true },
                  })
                : []

        // ── รายวัน — เติมวันที่ไม่มีบันทึกให้ครบช่วง เพื่อให้กราฟไม่ขาดตอน ──
        const dayMap = new Map(
            byDayRaw.map((r) => [
                r.workDate.toISOString().slice(0, 10),
                { hours: decimalToNumber(r._sum.hours), entries: r._count._all },
            ])
        )
        const byDay = daysInRange(range.from, range.to).map((iso) => {
            const hit = dayMap.get(iso)
            return {
                key: iso,
                label: shortThaiDay(iso),
                hours: roundHours(hit?.hours ?? 0),
                entries: hit?.entries ?? 0,
            }
        })

        // ── แยกตามประเภทงาน — เรียงชั่วโมงมากไปน้อย ──
        const byRefType = byRefRaw
            .map((r) => ({
                key: r.refType,
                label: WORKLOG_REF_LABEL[r.refType as WorkLogRefType] ?? r.refType,
                hours: roundHours(decimalToNumber(r._sum.hours)),
                entries: r._count._all,
            }))
            .sort((a, b) => b.hours - a.hours)

        // ── รายคน (F3.8) — เติมชื่อและจำนวน Ticket ที่ยังค้างอยู่ในมือ ──
        let byUser: { key: string; label: string; hours: number; entries: number; openTickets: number }[] =
            []
        if (query.scope === "team" && byUserRaw.length > 0) {
            const userIds = byUserRaw.map((r) => r.userId)
            const [people, openCounts] = await Promise.all([
                prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, name: true },
                }),
                prisma.ticket.groupBy({
                    by: ["assigneeId"],
                    where: {
                        assigneeId: { in: userIds },
                        status: { in: ["assigned", "in_progress"] },
                    },
                    _count: { _all: true },
                }),
            ])

            const nameOf = new Map(people.map((p) => [p.id, p.name]))
            const openOf = new Map(
                openCounts.map((c) => [c.assigneeId ?? "", c._count._all])
            )

            byUser = byUserRaw
                .map((r) => ({
                    key: r.userId,
                    label: nameOf.get(r.userId) ?? "ผู้ใช้ที่ถูกลบแล้ว",
                    hours: roundHours(decimalToNumber(r._sum.hours)),
                    entries: r._count._all,
                    openTickets: openOf.get(r.userId) ?? 0,
                }))
                .sort((a, b) => b.hours - a.hours)
        }

        const totalHours = roundHours(byDay.reduce((sum, d) => sum + d.hours, 0))
        const totalEntries = byDay.reduce((sum, d) => sum + d.entries, 0)

        return NextResponse.json({
            range,
            period: query.period,
            scope: query.scope,
            totalHours,
            totalEntries,
            daysLogged: byDay.filter((d) => d.entries > 0).length,
            byDay,
            byRefType,
            byUser,
        })
    } catch (error) {
        console.error("WorkLog summary GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถสรุปชั่วโมงทำงานได้" }, { status: 500 })
    }
}
