// lib/report-service.ts
// ตรรกะรวบรวมตัวเลขของรายงานประจำเดือน / ไตรมาส (F7.16–F7.21)
// อ้างอิง docs/spec.md §8 ⑦C
//
// หลักการที่ยึดทั้งไฟล์:
//   1. "รับเข้า" นับจาก `createdAt` · "แก้ไขแล้ว" นับจาก `resolvedAt` · "ปิดงาน" นับจาก `closedAt`
//      แต่ละตัวจึงเป็นคนละชุดใบกัน — ใบที่ปิดเดือนนี้อาจแจ้งมาตั้งแต่เดือนก่อน
//   2. "ค้าง" คิดย้อนเวลาได้จริง — นับใบที่แจ้งก่อนสิ้นช่วง และ ณ เวลานั้นยังไม่ resolved/closed
//      (ไม่ได้ดูสถานะปัจจุบัน จึงเปิดรายงานเดือนเก่าย้อนหลังแล้วตัวเลขไม่เพี้ยน)
//   3. สัดส่วนตามหมวด/ความสำคัญ/ช่องทาง และ SLA คิดจาก "ใบที่แจ้งเข้ามาในช่วง" เท่านั้น
//      ให้ตรงกับรายงาน SLA เดิมใน api/reports/sla

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import type { AuthUser } from "@/lib/rbac"
import { isManager } from "@/lib/rbac"
import { PRIORITY_LABEL, PRIORITY_WEIGHT, type Priority } from "@/lib/priority"
import {
    TICKET_CHANNEL_LABEL,
    TICKET_STATUS_LABEL,
    type TicketChannel,
    type TicketStatus,
} from "@/lib/ticket-workflow"
import {
    ASSET_STATUS_LABEL,
    ASSET_TYPE_LABEL,
    type AssetStatus,
    type AssetType,
} from "@/lib/asset-workflow"
import { APPROVAL_TYPE_LABEL, type ApprovalType } from "@/lib/approval-workflow"
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/task-board"
import { decimalToNumber } from "@/lib/worklog-service"
import { evaluateTicketSla } from "@/lib/sla-service"
import { daysBetween, previousPeriod } from "@/lib/report-schema"
import {
    addThaiDays,
    endOfThaiDay,
    startOfThaiDay,
    thaiDayKey,
    thaiMonthKey,
    thaiMonthLabel,
} from "@/lib/thai-date"
import type {
    ApprovalSection,
    AssetSection,
    CountGroup,
    Metric,
    ProjectProgressRow,
    ProjectSection,
    ReportPeriod,
    SlaSection,
    SummaryReport,
    TicketSection,
    TrendGranularity,
    TrendPoint,
    WorkloadRow,
    WorkloadSection,
} from "@/lib/report-types"

/// เพดานจำนวนใบต่อการออกรายงานหนึ่งครั้ง — รวมสถิติในหน่วยความจำจึงต้องจำกัด
const MAX_ROWS = 20000

/// ช่วงเวลาที่ยาวเกินนี้จะสรุปแนวโน้มเป็นรายเดือนแทนรายวัน
const DAILY_TREND_MAX_DAYS = 62

/// ครุภัณฑ์ที่หมดประกันภายในกี่วันนับจากวันสิ้นสุดช่วง ถือว่า "ใกล้หมดประกัน"
const WARRANTY_WINDOW_DAYS = 90

// ── ตัวช่วยเล็กๆ ─────────────────────────────────────────────────────

/// สร้างค่าพร้อมตัวเทียบช่วงก่อนหน้า
function metric(value: number, previous: number | null): Metric {
    if (previous === null) return { value, previous: null, delta: null, percent: null }
    const delta = value - previous
    const percent = previous === 0 ? null : Math.round((delta / previous) * 1000) / 10
    return { value, previous, delta, percent }
}

/// รวมจำนวนตามคีย์แล้วเรียงมาก → น้อย
function groupCount(
    entries: { key: string; label: string }[],
    order?: (a: CountGroup, b: CountGroup) => number
): CountGroup[] {
    const map = new Map<string, CountGroup>()
    for (const e of entries) {
        const g = map.get(e.key)
        if (g) g.count += 1
        else map.set(e.key, { key: e.key, label: e.label, count: 1 })
    }
    return [...map.values()].sort(order ?? ((a, b) => b.count - a.count))
}

function round1(value: number): number {
    return Math.round(value * 10) / 10
}

// ── ฟิลด์ที่รายงานต้องใช้จาก Ticket ──────────────────────────────────

const reportTicketSelect = {
    id: true,
    priority: true,
    status: true,
    channel: true,
    categoryId: true,
    assigneeId: true,
    createdAt: true,
    respondedAt: true,
    resolvedAt: true,
    responseDueAt: true,
    resolutionDueAt: true,
    category: { select: { name: true } },
} satisfies Prisma.TicketSelect

type ReportTicket = Prisma.TicketGetPayload<{ select: typeof reportTicketSelect }>

// ── ขอบเขตตามสิทธิ์ (spec §7 — "รายงาน/Dashboard รวม") ───────────────

export interface ReportScope {
    /// "own" = agent เห็นเฉพาะงานที่ตัวเองรับผิดชอบ · "all" = manager ขึ้นไปเห็นทั้งศูนย์
    kind: "own" | "all"
    userId: string
}

export function scopeOf(user: AuthUser): ReportScope {
    return { kind: isManager(user) ? "all" : "own", userId: user.id }
}

/// เงื่อนไขจำกัดใบตามขอบเขต
function ticketScope(scope: ReportScope): Prisma.TicketWhereInput {
    return scope.kind === "all" ? {} : { assigneeId: scope.userId }
}

// ── ① สรุป Ticket (F7.16) ────────────────────────────────────────────

/// นับใบที่ "ยังค้าง" ณ เวลาสิ้นสุดช่วง — ดูหลักการข้อ 2 ที่หัวไฟล์
function pendingAtWhere(scope: ReportScope, endAt: Date): Prisma.TicketWhereInput {
    return {
        ...ticketScope(scope),
        createdAt: { lte: endAt },
        AND: [
            { OR: [{ resolvedAt: null }, { resolvedAt: { gt: endAt } }] },
            { OR: [{ closedAt: null }, { closedAt: { gt: endAt } }] },
        ],
    }
}

interface TicketCounts {
    created: number
    resolved: number
    closed: number
    pending: number
}

/// ตัวเลขหลัก 4 ตัวของช่วงหนึ่ง — ใช้ทั้งช่วงปัจจุบันและช่วงเทียบ
async function ticketCounts(scope: ReportScope, period: ReportPeriod): Promise<TicketCounts> {
    const start = startOfThaiDay(period.from)
    const end = endOfThaiDay(period.to)
    const base = ticketScope(scope)

    const [created, resolved, closed, pending] = await Promise.all([
        prisma.ticket.count({ where: { ...base, createdAt: { gte: start, lte: end } } }),
        prisma.ticket.count({ where: { ...base, resolvedAt: { gte: start, lte: end } } }),
        prisma.ticket.count({ where: { ...base, closedAt: { gte: start, lte: end } } }),
        prisma.ticket.count({ where: pendingAtWhere(scope, end) }),
    ])

    return { created, resolved, closed, pending }
}

function buildTicketSection(
    rows: ReportTicket[],
    current: TicketCounts,
    prev: TicketCounts
): TicketSection {
    const resolvedRows = rows.filter((t) => t.resolvedAt !== null)
    const totalHours = resolvedRows.reduce(
        (sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000,
        0
    )

    return {
        created: metric(current.created, prev.created),
        resolved: metric(current.resolved, prev.resolved),
        closed: metric(current.closed, prev.closed),
        pending: metric(current.pending, prev.pending),
        avgResolutionHours:
            resolvedRows.length > 0 ? round1(totalHours / resolvedRows.length) : null,
        byCategory: groupCount(
            rows.map((t) => ({
                key: t.categoryId,
                label: t.category?.name ?? "ไม่ระบุหมวดหมู่",
            }))
        ),
        byPriority: groupCount(
            rows.map((t) => ({
                key: t.priority,
                label: PRIORITY_LABEL[t.priority as Priority] ?? t.priority,
            })),
            (a, b) =>
                (PRIORITY_WEIGHT[b.key as Priority] ?? 0) - (PRIORITY_WEIGHT[a.key as Priority] ?? 0)
        ),
        byChannel: groupCount(
            rows.map((t) => ({
                key: t.channel,
                label: TICKET_CHANNEL_LABEL[t.channel as TicketChannel] ?? t.channel,
            }))
        ),
        byStatus: groupCount(
            rows.map((t) => ({
                key: t.status,
                label: TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status,
            }))
        ),
    }
}

// ── ② SLA Compliance (F7.17) ─────────────────────────────────────────

/// คิด % จากใบที่ "รู้ผลแล้ว" เท่านั้น เหมือน api/reports/sla (ดู lib/sla-service.ts)
function tallySla(list: ReportTicket[], now: Date) {
    let responseMeasured = 0
    let responseMet = 0
    let resolutionMeasured = 0
    let resolutionMet = 0
    let breached = 0

    for (const t of list) {
        const o = evaluateTicketSla(t, now)
        if (o.responseMeasured) {
            responseMeasured += 1
            if (o.responseMet) responseMet += 1
            else breached += 1
        }
        if (o.resolutionMeasured) {
            resolutionMeasured += 1
            if (o.resolutionMet) resolutionMet += 1
            else breached += 1
        }
    }

    const rate = (met: number, measured: number) =>
        measured > 0 ? Math.round((met / measured) * 1000) / 10 : null

    return {
        responseMeasured,
        responseMet,
        resolutionMeasured,
        resolutionMet,
        breached,
        responseRate: rate(responseMet, responseMeasured),
        resolutionRate: rate(resolutionMet, resolutionMeasured),
    }
}

function buildSlaSection(rows: ReportTicket[], prevRows: ReportTicket[], now: Date): SlaSection {
    const cur = tallySla(rows, now)
    const prev = tallySla(prevRows, now)

    return {
        responseRate: cur.responseRate,
        resolutionRate: cur.resolutionRate,
        responseMeasured: cur.responseMeasured,
        responseMet: cur.responseMet,
        resolutionMeasured: cur.resolutionMeasured,
        resolutionMet: cur.resolutionMet,
        breached: cur.breached,
        previousResolutionRate: prev.resolutionRate,
    }
}

// ── ③ ภาระงานเจ้าหน้าที่ (F7.18) ─────────────────────────────────────

/// WorkLog.workDate เป็น @db.Date จึงต้องเทียบด้วยเที่ยงคืน UTC ตรงๆ (ดู lib/sla-service.ts)
function workDateRange(period: ReportPeriod) {
    return {
        gte: new Date(`${period.from}T00:00:00.000Z`),
        lte: new Date(`${period.to}T00:00:00.000Z`),
    }
}

async function buildWorkloadSection(
    scope: ReportScope,
    period: ReportPeriod
): Promise<WorkloadSection> {
    const start = startOfThaiDay(period.from)
    const end = endOfThaiDay(period.to)
    const base = ticketScope(scope)

    const [assignedGroups, resolvedGroups, openGroups, hourGroups] = await Promise.all([
        prisma.ticket.groupBy({
            by: ["assigneeId"],
            where: { ...base, assigneeId: { not: null }, createdAt: { gte: start, lte: end } },
            _count: { _all: true },
        }),
        prisma.ticket.groupBy({
            by: ["assigneeId"],
            where: { ...base, assigneeId: { not: null }, resolvedAt: { gte: start, lte: end } },
            _count: { _all: true },
        }),
        prisma.ticket.groupBy({
            by: ["assigneeId"],
            where: {
                ...base,
                assigneeId: { not: null },
                status: { in: ["new", "assigned", "in_progress"] },
            },
            _count: { _all: true },
        }),
        prisma.workLog.groupBy({
            by: ["userId"],
            where: {
                workDate: workDateRange(period),
                ...(scope.kind === "own" ? { userId: scope.userId } : {}),
            },
            _sum: { hours: true },
        }),
    ])

    const rows = new Map<string, WorkloadRow>()
    const ensure = (userId: string): WorkloadRow => {
        let row = rows.get(userId)
        if (!row) {
            row = { userId, name: userId, assigned: 0, resolved: 0, openNow: 0, hours: 0 }
            rows.set(userId, row)
        }
        return row
    }

    for (const g of assignedGroups) if (g.assigneeId) ensure(g.assigneeId).assigned = g._count._all
    for (const g of resolvedGroups) if (g.assigneeId) ensure(g.assigneeId).resolved = g._count._all
    for (const g of openGroups) if (g.assigneeId) ensure(g.assigneeId).openNow = g._count._all
    for (const g of hourGroups) ensure(g.userId).hours = round1(decimalToNumber(g._sum.hours))

    // เติมชื่อคนทีเดียว — groupBy คืนมาแค่ id
    const users = await prisma.user.findMany({
        where: { id: { in: [...rows.keys()] } },
        select: { id: true, name: true },
    })
    for (const u of users) {
        const row = rows.get(u.id)
        if (row) row.name = u.name
    }

    const list = [...rows.values()].sort(
        (a, b) => b.hours - a.hours || b.assigned - a.assigned || a.name.localeCompare(b.name, "th")
    )

    return {
        rows: list,
        totalHours: round1(list.reduce((sum, r) => sum + r.hours, 0)),
    }
}

// ── ④ ความคืบหน้าโครงการ SDLC (F7.19) ────────────────────────────────

async function buildProjectSection(
    scope: ReportScope,
    period: ReportPeriod,
    prev: ReportPeriod,
    now: Date
): Promise<ProjectSection> {
    // agent เห็นเฉพาะโครงการที่ตัวเองมี Task อยู่ (spec §7 — Project: อ่าน + แก้ task ตัวเอง)
    const projectWhere: Prisma.ProjectWhereInput =
        scope.kind === "all" ? {} : { tasks: { some: { assigneeId: scope.userId } } }
    const taskScope: Prisma.TaskWhereInput =
        scope.kind === "all" ? {} : { assigneeId: scope.userId }

    const [projects, taskGroups, overdueGroups, workLogs, tasksDone, tasksDonePrev] =
        await Promise.all([
            prisma.project.findMany({
                where: projectWhere,
                select: {
                    id: true,
                    code: true,
                    name: true,
                    status: true,
                    progress: true,
                    endDate: true,
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma.task.groupBy({
                by: ["projectId", "boardStatus"],
                where: taskScope,
                _count: { _all: true },
            }),
            prisma.task.groupBy({
                by: ["projectId"],
                where: { ...taskScope, boardStatus: { not: "done" }, dueDate: { lt: now } },
                _count: { _all: true },
            }),
            prisma.workLog.findMany({
                where: {
                    taskId: { not: null },
                    workDate: workDateRange(period),
                    ...(scope.kind === "own" ? { userId: scope.userId } : {}),
                },
                select: { hours: true, task: { select: { projectId: true } } },
            }),
            // ยังไม่มีคอลัมน์ "ปิดงานเมื่อไร" ใน Task — ใช้ updatedAt ของใบที่สถานะเป็น done
            // เป็นตัวแทน (ใบที่ถูกแก้อย่างอื่นหลังปิดงานจะถูกนับเข้าช่วงที่แก้ล่าสุดแทน)
            prisma.task.count({
                where: {
                    ...taskScope,
                    boardStatus: "done",
                    updatedAt: { gte: startOfThaiDay(period.from), lte: endOfThaiDay(period.to) },
                },
            }),
            prisma.task.count({
                where: {
                    ...taskScope,
                    boardStatus: "done",
                    updatedAt: { gte: startOfThaiDay(prev.from), lte: endOfThaiDay(prev.to) },
                },
            }),
        ])

    const totals = new Map<string, { total: number; done: number }>()
    for (const g of taskGroups) {
        const t = totals.get(g.projectId) ?? { total: 0, done: 0 }
        t.total += g._count._all
        if (g.boardStatus === "done") t.done += g._count._all
        totals.set(g.projectId, t)
    }

    const overdue = new Map(overdueGroups.map((g) => [g.projectId, g._count._all]))

    const hours = new Map<string, number>()
    for (const log of workLogs) {
        const pid = log.task?.projectId
        if (!pid) continue
        hours.set(pid, (hours.get(pid) ?? 0) + decimalToNumber(log.hours))
    }

    const rows: ProjectProgressRow[] = projects.map((p) => {
        const t = totals.get(p.id) ?? { total: 0, done: 0 }
        return {
            id: p.id,
            code: p.code,
            name: p.name,
            status: p.status,
            progress: p.progress,
            totalTasks: t.total,
            doneTasks: t.done,
            overdueTasks: overdue.get(p.id) ?? 0,
            hours: round1(hours.get(p.id) ?? 0),
            endDate: p.endDate ? p.endDate.toISOString() : null,
        }
    })

    return {
        rows,
        byStatus: groupCount(
            projects.map((p) => ({
                key: p.status,
                label: PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status,
            }))
        ),
        tasksDone: metric(tasksDone, tasksDonePrev),
    }
}

// ── ⑤ ครุภัณฑ์ (F7.20) ───────────────────────────────────────────────

async function buildAssetSection(
    scope: ReportScope,
    period: ReportPeriod,
    prev: ReportPeriod
): Promise<AssetSection> {
    // agent ดูครุภัณฑ์ได้ทั้งหมดตาม RBAC แต่ในรายงาน "ของตัวเอง" เหลือเฉพาะที่ตัวเองครอบครอง
    const base: Prisma.AssetWhereInput = scope.kind === "all" ? {} : { custodianId: scope.userId }

    // Asset.purchaseDate / warrantyEndDate เป็น DateTime ที่เก็บเป็นวันล้วน — เทียบแบบ UTC เหมือน WorkLog
    const purchaseRange = (p: ReportPeriod) => ({
        gte: new Date(`${p.from}T00:00:00.000Z`),
        lte: new Date(`${p.to}T23:59:59.999Z`),
    })

    const [all, purchasedAgg, purchasedPrev, warrantyExpiring] = await Promise.all([
        prisma.asset.findMany({ where: base, select: { status: true, type: true } }),
        prisma.asset.aggregate({
            where: { ...base, purchaseDate: purchaseRange(period) },
            _count: { _all: true },
            _sum: { price: true },
        }),
        prisma.asset.count({ where: { ...base, purchaseDate: purchaseRange(prev) } }),
        prisma.asset.count({
            where: {
                ...base,
                status: { not: "disposed" },
                warrantyEndDate: {
                    gte: new Date(`${period.to}T00:00:00.000Z`),
                    lte: new Date(`${addThaiDays(period.to, WARRANTY_WINDOW_DAYS)}T23:59:59.999Z`),
                },
            },
        }),
    ])

    return {
        total: all.length,
        byStatus: groupCount(
            all.map((a) => ({
                key: a.status,
                label: ASSET_STATUS_LABEL[a.status as AssetStatus] ?? a.status,
            }))
        ),
        byType: groupCount(
            all.map((a) => ({
                key: a.type,
                label: ASSET_TYPE_LABEL[a.type as AssetType] ?? a.type,
            }))
        ),
        purchased: metric(purchasedAgg._count._all, purchasedPrev),
        purchasedValue: round1(decimalToNumber(purchasedAgg._sum.price)),
        warrantyExpiring,
    }
}

// ── ⑥ คำขออนุมัติ (F7.20) ────────────────────────────────────────────

async function buildApprovalSection(
    scope: ReportScope,
    period: ReportPeriod,
    prev: ReportPeriod
): Promise<ApprovalSection> {
    const base: Prisma.ApprovalRequestWhereInput =
        scope.kind === "all" ? {} : { requesterId: scope.userId }

    const range = (p: ReportPeriod) => ({
        gte: startOfThaiDay(p.from),
        lte: endOfThaiDay(p.to),
    })

    // ยังไม่มีคอลัมน์ "ตัดสินเมื่อไร" ที่ระดับใบคำขอ — ใช้ updatedAt ของใบที่สถานะสุดท้ายแล้ว
    // เป็นเวลาตัดสิน เพราะการเปลี่ยนสถานะครั้งสุดท้ายคือการอนุมัติ/ไม่อนุมัติเสมอ
    const [
        createdNow,
        createdPrev,
        approved,
        approvedPrev,
        rejected,
        rejectedPrev,
        pending,
        rows,
        amountAgg,
    ] = await Promise.all([
        prisma.approvalRequest.count({ where: { ...base, createdAt: range(period) } }),
        prisma.approvalRequest.count({ where: { ...base, createdAt: range(prev) } }),
        prisma.approvalRequest.count({
            where: { ...base, status: "approved", updatedAt: range(period) },
        }),
        prisma.approvalRequest.count({
            where: { ...base, status: "approved", updatedAt: range(prev) },
        }),
        prisma.approvalRequest.count({
            where: { ...base, status: "rejected", updatedAt: range(period) },
        }),
        prisma.approvalRequest.count({
            where: { ...base, status: "rejected", updatedAt: range(prev) },
        }),
        prisma.approvalRequest.count({ where: { ...base, status: "pending" } }),
        prisma.approvalRequest.findMany({
            where: { ...base, createdAt: range(period) },
            select: { type: true },
        }),
        prisma.approvalRequest.aggregate({
            where: { ...base, status: "approved", updatedAt: range(period) },
            _sum: { amount: true },
        }),
    ])

    return {
        created: metric(createdNow, createdPrev),
        approved: metric(approved, approvedPrev),
        rejected: metric(rejected, rejectedPrev),
        pending,
        byType: groupCount(
            rows.map((r) => ({
                key: r.type,
                label: APPROVAL_TYPE_LABEL[r.type as ApprovalType] ?? r.type,
            }))
        ),
        approvedAmount: round1(decimalToNumber(amountAgg._sum.amount)),
    }
}

// ── ⑦ แนวโน้ม (F7.21) ────────────────────────────────────────────────

interface TrendBucket {
    key: string
    label: string
    created: number
    resolved: number
    measured: number
    met: number
}

/// จัดใบลงถังตามวันหรือเดือน แล้วคิด % แก้ไขตรงเวลาของแต่ละถัง
function buildTrend(
    rows: ReportTicket[],
    resolvedAtList: Date[],
    period: ReportPeriod,
    now: Date
): { granularity: TrendGranularity; points: TrendPoint[] } {
    const span = daysBetween(period.from, period.to) + 1
    const granularity: TrendGranularity = span <= DAILY_TREND_MAX_DAYS ? "day" : "month"

    const keyOf = (d: Date) => (granularity === "day" ? thaiDayKey(d) : thaiMonthKey(d))
    const labelOf = (d: Date) =>
        granularity === "day"
            ? d.toLocaleDateString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  day: "numeric",
                  month: "short",
              })
            : thaiMonthLabel(d)

    const buckets = new Map<string, TrendBucket>()
    const ensure = (d: Date): TrendBucket => {
        const key = keyOf(d)
        let b = buckets.get(key)
        if (!b) {
            b = { key, label: labelOf(d), created: 0, resolved: 0, measured: 0, met: 0 }
            buckets.set(key, b)
        }
        return b
    }

    for (const t of rows) {
        const b = ensure(t.createdAt)
        b.created += 1
        const o = evaluateTicketSla(t, now)
        if (o.resolutionMeasured) {
            b.measured += 1
            if (o.resolutionMet) b.met += 1
        }
    }
    for (const d of resolvedAtList) ensure(d).resolved += 1

    const points: TrendPoint[] = [...buckets.values()]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((b) => ({
            key: b.key,
            label: b.label,
            created: b.created,
            resolved: b.resolved,
            slaRate: b.measured > 0 ? Math.round((b.met / b.measured) * 1000) / 10 : null,
        }))

    return { granularity, points }
}

// ── ประกอบรายงานทั้งฉบับ ─────────────────────────────────────────────

export async function buildSummaryReport(
    user: AuthUser,
    period: ReportPeriod
): Promise<SummaryReport> {
    const scope = scopeOf(user)
    const prev = previousPeriod(period)
    const now = new Date()

    const base = ticketScope(scope)
    const inPeriod = { gte: startOfThaiDay(period.from), lte: endOfThaiDay(period.to) }
    const inPrev = { gte: startOfThaiDay(prev.from), lte: endOfThaiDay(prev.to) }

    const [rows, prevRows, resolvedInPeriod, counts, prevCounts] = await Promise.all([
        prisma.ticket.findMany({
            where: { ...base, createdAt: inPeriod },
            select: reportTicketSelect,
            orderBy: { createdAt: "asc" },
            take: MAX_ROWS,
        }),
        prisma.ticket.findMany({
            where: { ...base, createdAt: inPrev },
            select: reportTicketSelect,
            orderBy: { createdAt: "asc" },
            take: MAX_ROWS,
        }),
        prisma.ticket.findMany({
            where: { ...base, resolvedAt: inPeriod },
            select: { resolvedAt: true },
            take: MAX_ROWS,
        }),
        ticketCounts(scope, period),
        ticketCounts(scope, prev),
    ])

    const [workload, projects, assets, approvals] = await Promise.all([
        buildWorkloadSection(scope, period),
        buildProjectSection(scope, period, prev, now),
        buildAssetSection(scope, period, prev),
        buildApprovalSection(scope, period, prev),
    ])

    const resolvedDates = resolvedInPeriod
        .map((t) => t.resolvedAt)
        .filter((d): d is Date => d !== null)

    return {
        period,
        previousPeriod: prev,
        scope: scope.kind,
        generatedAt: now.toISOString(),
        truncated: rows.length >= MAX_ROWS || prevRows.length >= MAX_ROWS,
        tickets: buildTicketSection(rows, counts, prevCounts),
        sla: buildSlaSection(rows, prevRows, now),
        workload,
        projects,
        assets,
        approvals,
        trend: buildTrend(rows, resolvedDates, period, now),
    }
}
