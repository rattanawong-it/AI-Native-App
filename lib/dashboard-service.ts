// lib/dashboard-service.ts
// เตรียมข้อมูลแดชบอร์ดแยกตาม role (F9.1–F9.5, F3.9)
// อ้างอิง docs/spec.md §8 ⑨
//
// แดชบอร์ดสร้างฝั่ง server แล้วส่งเป็น props ให้ client component — ไม่มี API เส้นแยก
// เพราะนี่คือหน้าแรกหลัง login การรอ fetch อีกรอบทำให้หน้าว่างโดยไม่จำเป็น
//
// ตัวเลขที่ซ้ำกับรายงานสรุปใช้ helper ตัวเดียวกันจาก lib/report-service.ts
// (buildTrend, tallySla) แดชบอร์ดกับรายงานจึงไม่มีวันให้ตัวเลขคนละชุด

import { prisma } from "@/lib/prisma"
import type { AuthUser } from "@/lib/rbac"
import { isManager, isStaff } from "@/lib/rbac"
import { compareByQueueOrder } from "@/lib/priority"
import { OPEN_STATUSES, TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/ticket-workflow"
import { breachWhere } from "@/lib/sla-service"
import {
    buildTrend,
    reportTicketSelect,
    tallySla,
    type ReportTicket,
} from "@/lib/report-service"
import {
    decimalToNumber,
    isDueToday,
    isOverdue,
    loadWorkItems,
    roundHours,
    summaryRange,
    compareWorkItems,
} from "@/lib/worklog-service"
import { endOfThaiDay, startOfThaiDay, thaiToday } from "@/lib/thai-date"
import type {
    CenterSection,
    DashboardData,
    DashboardTicketBrief,
    DashboardView,
    MineSection,
    WorkSection,
} from "@/lib/dashboard-types"

/// ช่วงย้อนหลังที่แดชบอร์ดรองรับ (F9.5)
export const DASHBOARD_RANGES = [7, 30] as const

/// จำนวนรายการต่อ widget — แดชบอร์ดเป็นหน้าสรุป ไม่ใช่หน้ารายการ
const LIST_LIMIT = 6

/// "ใกล้ครบกำหนด" = เหลือไม่เกินกี่ชั่วโมง (F9.3)
const AT_RISK_HOURS = 24

export function normalizeRange(raw: string | undefined): number {
    const n = Number(raw)
    return (DASHBOARD_RANGES as readonly number[]).includes(n) ? n : 30
}

function viewOf(user: AuthUser): DashboardView {
    if (isManager(user)) return "manager"
    if (isStaff(user)) return "agent"
    return "requester"
}

const briefSelect = {
    id: true,
    ticketNo: true,
    title: true,
    status: true,
    priority: true,
    resolutionDueAt: true,
    category: { select: { name: true } },
    requester: { select: { name: true } },
} as const

type BriefRow = {
    id: string
    ticketNo: string
    title: string
    status: string
    priority: string
    resolutionDueAt: Date | null
    category: { name: string } | null
    requester: { name: string } | null
}

function toBrief(t: BriefRow, context: "category" | "requester"): DashboardTicketBrief {
    return {
        id: t.id,
        ticketNo: t.ticketNo,
        title: t.title,
        status: t.status,
        priority: t.priority,
        resolutionDueAt: t.resolutionDueAt?.toISOString() ?? null,
        context: context === "category" ? (t.category?.name ?? null) : (t.requester?.name ?? null),
    }
}

// ── ① Ticket ที่ตัวเองแจ้ง (F9.2) ────────────────────────────────────

async function buildMine(userId: string): Promise<MineSection> {
    const [open, waitingConfirm, total, recent] = await Promise.all([
        prisma.ticket.count({ where: { requesterId: userId, status: { in: OPEN_STATUSES } } }),
        prisma.ticket.count({ where: { requesterId: userId, status: "resolved" } }),
        prisma.ticket.count({ where: { requesterId: userId } }),
        prisma.ticket.findMany({
            where: { requesterId: userId },
            select: briefSelect,
            orderBy: { updatedAt: "desc" },
            take: LIST_LIMIT,
        }),
    ])

    return {
        open,
        waitingConfirm,
        total,
        recent: recent.map((t) => toBrief(t, "category")),
    }
}

// ── ② งานของเจ้าหน้าที่ (F9.3, F3.9) ─────────────────────────────────

async function buildWork(userId: string, now: Date): Promise<WorkSection> {
    const today = thaiToday()
    const week = summaryRange(today, "week")

    const [openTickets, atRisk, hoursAgg, items] = await Promise.all([
        prisma.ticket.findMany({
            where: { assigneeId: userId, status: { in: OPEN_STATUSES } },
            select: briefSelect,
            orderBy: { updatedAt: "desc" },
            take: 200,
        }),
        prisma.ticket.count({
            where: {
                assigneeId: userId,
                status: { in: OPEN_STATUSES },
                resolvedAt: null,
                resolutionDueAt: {
                    gte: now,
                    lte: new Date(now.getTime() + AT_RISK_HOURS * 3_600_000),
                },
            },
        }),
        prisma.workLog.aggregate({
            where: {
                userId,
                workDate: {
                    gte: new Date(`${week.from}T00:00:00.000Z`),
                    lte: new Date(`${week.to}T00:00:00.000Z`),
                },
            },
            _sum: { hours: true },
        }),
        // ใช้ตัวโหลดตัวเดียวกับหน้า My Work — งานวันนี้/เลยกำหนดสองที่จึงตรงกันเสมอ
        loadWorkItems(userId),
    ])

    const overdueItems = items.filter((i) => isOverdue(i, now)).sort(compareWorkItems)
    const dueTodayItems = items.filter((i) => isDueToday(i, today)).sort(compareWorkItems)

    const queue = [...openTickets]
        .sort(compareByQueueOrder)
        .slice(0, LIST_LIMIT)
        .map((t) => toBrief(t, "requester"))

    return {
        openNow: openTickets.length,
        dueToday: dueTodayItems.length,
        overdue: overdueItems.length,
        atRisk,
        hoursThisWeek: roundHours(decimalToNumber(hoursAgg._sum.hours)),
        queue,
        dueTodayItems: dueTodayItems.slice(0, LIST_LIMIT),
        overdueItems: overdueItems.slice(0, LIST_LIMIT),
    }
}

// ── ③ ภาพรวมทั้งศูนย์ (F9.4, F9.5) ───────────────────────────────────

async function buildCenter(rangeDays: number, now: Date): Promise<CenterSection> {
    const to = thaiToday()
    const from = thaiToday(-(rangeDays - 1))
    const inRange = { gte: startOfThaiDay(from), lte: endOfThaiDay(to) }

    const [
        rows,
        resolvedRows,
        pending,
        breachedOpen,
        unassigned,
        pendingApprovals,
        statusGroups,
        openByAssignee,
        hourGroups,
        projects,
        taskGroups,
        overdueTaskGroups,
    ] = await Promise.all([
        prisma.ticket.findMany({
            where: { createdAt: inRange },
            select: reportTicketSelect,
            orderBy: { createdAt: "asc" },
        }),
        prisma.ticket.findMany({
            where: { resolvedAt: inRange },
            select: { resolvedAt: true },
        }),
        prisma.ticket.count({ where: { status: { in: OPEN_STATUSES } } }),
        prisma.ticket.count({
            where: { status: { in: OPEN_STATUSES }, ...breachWhere("any", now) },
        }),
        prisma.ticket.count({ where: { assigneeId: null, status: { in: OPEN_STATUSES } } }),
        prisma.approvalRequest.count({ where: { status: "pending" } }),
        prisma.ticket.groupBy({
            by: ["status"],
            where: { status: { in: OPEN_STATUSES } },
            _count: { _all: true },
        }),
        prisma.ticket.groupBy({
            by: ["assigneeId"],
            where: { assigneeId: { not: null }, status: { in: OPEN_STATUSES } },
            _count: { _all: true },
        }),
        prisma.workLog.groupBy({
            by: ["userId"],
            where: {
                workDate: {
                    gte: new Date(`${from}T00:00:00.000Z`),
                    lte: new Date(`${to}T00:00:00.000Z`),
                },
            },
            _sum: { hours: true },
        }),
        prisma.project.findMany({
            where: { status: { in: ["planning", "active", "on_hold"] } },
            select: { id: true, code: true, name: true, progress: true },
            orderBy: { updatedAt: "desc" },
            take: LIST_LIMIT,
        }),
        prisma.task.groupBy({ by: ["projectId", "boardStatus"], _count: { _all: true } }),
        prisma.task.groupBy({
            by: ["projectId"],
            where: { boardStatus: { not: "done" }, dueDate: { lt: now } },
            _count: { _all: true },
        }),
    ])

    const sla = tallySla(rows as ReportTicket[], now)

    const resolvedDates = resolvedRows
        .map((t) => t.resolvedAt)
        .filter((d): d is Date => d !== null)

    const trend = buildTrend(
        rows as ReportTicket[],
        resolvedDates,
        { type: "custom", from, to, label: `${rangeDays} วันล่าสุด` },
        now
    )

    // ภาระงานรายคน — รวมงานค้างในมือกับชั่วโมงที่ลงในช่วงนี้เข้าด้วยกัน
    const workload = new Map<string, { userId: string; name: string; openNow: number; hours: number }>()
    const ensure = (userId: string) => {
        let row = workload.get(userId)
        if (!row) {
            row = { userId, name: userId, openNow: 0, hours: 0 }
            workload.set(userId, row)
        }
        return row
    }
    for (const g of openByAssignee) if (g.assigneeId) ensure(g.assigneeId).openNow = g._count._all
    for (const g of hourGroups) ensure(g.userId).hours = roundHours(decimalToNumber(g._sum.hours))

    const users = await prisma.user.findMany({
        where: { id: { in: [...workload.keys()] } },
        select: { id: true, name: true },
    })
    for (const u of users) {
        const row = workload.get(u.id)
        if (row) row.name = u.name
    }

    const totals = new Map<string, { total: number; done: number }>()
    for (const g of taskGroups) {
        const t = totals.get(g.projectId) ?? { total: 0, done: 0 }
        t.total += g._count._all
        if (g.boardStatus === "done") t.done += g._count._all
        totals.set(g.projectId, t)
    }
    const overdueTasks = new Map(overdueTaskGroups.map((g) => [g.projectId, g._count._all]))

    return {
        created: rows.length,
        resolved: resolvedRows.length,
        pending,
        slaRate: sla.resolutionRate,
        breachedOpen,
        unassigned,
        pendingApprovals,
        trend: trend.points,
        byStatus: statusGroups
            .map((g) => ({
                key: g.status,
                label: TICKET_STATUS_LABEL[g.status as TicketStatus] ?? g.status,
                count: g._count._all,
            }))
            .sort((a, b) => b.count - a.count),
        topWorkload: [...workload.values()]
            .sort((a, b) => b.openNow - a.openNow || b.hours - a.hours)
            .slice(0, LIST_LIMIT),
        projects: projects.map((p) => {
            const t = totals.get(p.id) ?? { total: 0, done: 0 }
            return {
                id: p.id,
                code: p.code,
                name: p.name,
                progress: p.progress,
                doneTasks: t.done,
                totalTasks: t.total,
                overdueTasks: overdueTasks.get(p.id) ?? 0,
            }
        }),
    }
}

// ── ประกอบแดชบอร์ดตาม role ───────────────────────────────────────────

export async function buildDashboard(user: AuthUser, rangeDays: number): Promise<DashboardData> {
    const now = new Date()
    const view = viewOf(user)

    const [mine, work, center] = await Promise.all([
        buildMine(user.id),
        view === "requester" ? Promise.resolve(null) : buildWork(user.id, now),
        view === "manager" ? buildCenter(rangeDays, now) : Promise.resolve(null),
    ])

    return {
        view,
        userName: user.name,
        rangeDays,
        generatedAt: now.toISOString(),
        mine,
        work,
        center,
    }
}
