// app/api/reports/snapshots/route.ts
// GET  — รายการ Snapshot ที่บันทึกไว้ เพื่อเปรียบเทียบย้อนหลัง (F7.23)
// POST — บันทึกรายงานของช่วงที่เลือกไว้เป็น Snapshot
//
// เหตุผลที่ต้องเก็บ Snapshot: ตัวเลขบางตัวเปลี่ยนได้เมื่อเวลาผ่านไป — ใบที่ยังอยู่ในกำหนด
// SLA วันนี้ อาจกลายเป็น "เกินกำหนด" ในสัปดาห์หน้า การเก็บภาพนิ่งไว้ตอนปิดเดือนจึงทำให้
// ตัวเลขที่ส่งผู้บริหารไปแล้วยังตรวจสอบย้อนหลังได้
//
// สิทธิ์: หัวหน้าขึ้นไป (spec §7 — รายงานรวม)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, MANAGER_ROLES } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { reportPeriodQuerySchema, resolvePeriod } from "@/lib/report-schema"
import { buildSummaryReport } from "@/lib/report-service"
import { isoDateOf } from "@/lib/sla-service"
import type {
    PeriodType,
    SnapshotHighlights,
    SnapshotRow,
    SummaryReport,
} from "@/lib/report-types"

/// จำนวน Snapshot ที่คืนต่อครั้ง — เรียงใหม่สุดก่อน
const MAX_SNAPSHOTS = 60

/// ดึงตัวเลขหลักออกจากรายงานที่เก็บไว้ เพื่อโชว์ในตารางเทียบโดยไม่ต้องเปิดรายงานเต็ม
function toHighlights(report: SummaryReport): SnapshotHighlights {
    return {
        ticketsCreated: report.tickets.created.value,
        ticketsResolved: report.tickets.resolved.value,
        ticketsPending: report.tickets.pending.value,
        slaResolutionRate: report.sla.resolutionRate,
        totalHours: report.workload.totalHours,
        approvalsApproved: report.approvals.approved.value,
    }
}

/// ค่าที่ยังไม่รู้จักรูปแบบ (เช่น Snapshot ที่บันทึกด้วยโครงสร้างเก่า) จะได้ค่าศูนย์แทนการพัง
function safeHighlights(dataJson: unknown): { label: string; highlights: SnapshotHighlights } {
    const empty: SnapshotHighlights = {
        ticketsCreated: 0,
        ticketsResolved: 0,
        ticketsPending: 0,
        slaResolutionRate: null,
        totalHours: 0,
        approvalsApproved: 0,
    }

    if (!dataJson || typeof dataJson !== "object") return { label: "—", highlights: empty }
    const report = dataJson as Partial<SummaryReport>
    if (!report.tickets || !report.sla || !report.workload || !report.approvals) {
        return { label: report.period?.label ?? "—", highlights: empty }
    }

    return {
        label: report.period?.label ?? "—",
        highlights: toHighlights(report as SummaryReport),
    }
}

export async function GET() {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response

    try {
        const rows = await prisma.reportSnapshot.findMany({
            orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
            take: MAX_SNAPSHOTS,
        })

        // generatedBy เก็บเป็น id เปล่าๆ ไม่มี relation ในสคีมา — ดึงชื่อมาเติมทีเดียว
        const users = await prisma.user.findMany({
            where: { id: { in: [...new Set(rows.map((r) => r.generatedBy))] } },
            select: { id: true, name: true },
        })
        const nameOf = new Map(users.map((u) => [u.id, u.name]))

        const snapshots: SnapshotRow[] = rows.map((r) => {
            const { label, highlights } = safeHighlights(r.dataJson)
            return {
                id: r.id,
                type: r.type as PeriodType,
                periodStart: isoDateOf(r.periodStart),
                periodEnd: isoDateOf(r.periodEnd),
                label,
                generatedBy: r.generatedBy,
                generatedByName: nameOf.get(r.generatedBy) ?? null,
                createdAt: r.createdAt.toISOString(),
                highlights,
            }
        })

        return NextResponse.json({ snapshots })
    } catch (error) {
        console.error("Report snapshot GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถอ่านรายการ Snapshot ได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    // รับช่วงเวลาได้ทั้งจาก query string และ body — หน้าเว็บส่ง query ชุดเดียวกับตอนดูรายงาน
    let raw: Record<string, string> = searchParamsToObject(new URL(request.url))
    if (Object.keys(raw).length === 0) {
        try {
            const body = (await request.json()) as Record<string, unknown>
            raw = Object.fromEntries(
                Object.entries(body)
                    .filter(([, v]) => typeof v === "string" && v !== "")
                    .map(([k, v]) => [k, v as string])
            )
        } catch {
            return badRequest("ต้องระบุช่วงเวลาที่ต้องการบันทึก")
        }
    }

    const parsed = reportPeriodQuerySchema.safeParse(raw)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    const period = resolvePeriod(parsed.data)
    if (!period) {
        return badRequest("ช่วงกำหนดเองต้องระบุวันที่เริ่มต้นและสิ้นสุด และเริ่มต้องไม่หลังสิ้นสุด")
    }

    try {
        const report = await buildSummaryReport(user, period)
        const periodStart = new Date(`${period.from}T00:00:00.000Z`)
        const periodEnd = new Date(`${period.to}T00:00:00.000Z`)

        // บันทึกซ้ำช่วงเดิม = แทนที่ของเดิม เพื่อไม่ให้รายการเทียบย้อนหลังมีหลายแถวของเดือนเดียวกัน
        const snapshot = await prisma.$transaction(async (tx) => {
            await tx.reportSnapshot.deleteMany({
                where: { type: period.type, periodStart, periodEnd },
            })
            return tx.reportSnapshot.create({
                data: {
                    type: period.type,
                    periodStart,
                    periodEnd,
                    dataJson: JSON.parse(JSON.stringify(report)),
                    generatedBy: user.id,
                },
            })
        })

        return NextResponse.json(
            {
                snapshot: {
                    id: snapshot.id,
                    type: period.type,
                    periodStart: period.from,
                    periodEnd: period.to,
                    label: period.label,
                    generatedBy: user.id,
                    generatedByName: user.name,
                    createdAt: snapshot.createdAt.toISOString(),
                    highlights: toHighlights(report),
                } satisfies SnapshotRow,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error("Report snapshot POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึก Snapshot ได้" }, { status: 500 })
    }
}
