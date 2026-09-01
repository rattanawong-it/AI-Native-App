// lib/ticket-service.ts
// ตรรกะกลางของ Ticket ที่ API หลายเส้นใช้ร่วมกัน
//   - หา SLA Policy ที่ตรงกับ priority/หมวดหมู่ แล้วคำนวณกำหนดเวลา (F1.2, F4.5)
//   - Auto-assign ตาม ServiceCategory (F2.7)
//   - บันทึก TicketActivity (audit log)
//   - ประกอบ where ของหน้ารายการ + เรียงคิวงาน (F1.3, F1.4, F2.5)
// อ้างอิง docs/spec.md §5.2, §8 ①②

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { calculatePriority, type Priority } from "@/lib/priority"
import { calculateDueDates, getSlaProgress, type SlaStatus } from "@/lib/business-hours"
import type { AuthUser } from "@/lib/rbac"
import { isStaff } from "@/lib/rbac"
import type { TicketAction } from "@/lib/ticket-workflow"
import type { ListTicketsQuery } from "@/lib/ticket-schema"
import { breachWhere } from "@/lib/sla-service"

/// ตัวรับคำสั่ง Prisma — ใช้ตัวเดียวกันได้ทั้งใน transaction และนอก transaction
export type Db = Prisma.TransactionClient | typeof prisma

// ── AppSetting ───────────────────────────────────────────────────────

/// อ่านค่าตั้งค่าระบบ — คืน fallback ถ้ายังไม่มีคีย์นั้นใน DB
export async function getAppSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } })
    return (row?.value as T | undefined) ?? fallback
}

// ── SLA ──────────────────────────────────────────────────────────────

/// ค่า SLA เริ่มต้น (นาทีทำการ) ตาม spec §5.2 — ใช้เมื่อยังไม่มี SlaPolicy ใน DB
const FALLBACK_SLA: Record<Priority, { response: number; resolution: number }> = {
    critical: { response: 30, resolution: 4 * 60 },
    high: { response: 60, resolution: 8 * 60 },
    medium: { response: 4 * 60, resolution: 3 * 8 * 60 },
    low: { response: 8 * 60, resolution: 7 * 8 * 60 },
}

/// หา SLA Policy ที่ใช้กับ Ticket ใบนี้ — นโยบายเฉพาะหมวดหมู่มาก่อนนโยบายรวม
export async function resolveSlaPolicy(priority: Priority, categoryId: string | null) {
    const policies = await prisma.slaPolicy.findMany({
        where: {
            active: true,
            priority,
            OR: [{ categoryId: null }, ...(categoryId ? [{ categoryId }] : [])],
        },
    })

    const specific = policies.find((p) => p.categoryId === categoryId)
    const general = policies.find((p) => p.categoryId === null)
    const picked = specific ?? general

    return {
        responseMinutes: picked?.responseMinutes ?? FALLBACK_SLA[priority].response,
        resolutionMinutes: picked?.resolutionMinutes ?? FALLBACK_SLA[priority].resolution,
    }
}

/// คำนวณกำหนดเวลาตอบกลับ/แก้ไข จากเวลาทำการ (F4.5)
export async function computeDueDates(
    priority: Priority,
    categoryId: string | null,
    from: Date = new Date()
) {
    const { responseMinutes, resolutionMinutes } = await resolveSlaPolicy(priority, categoryId)
    return calculateDueDates(from, responseMinutes, resolutionMinutes)
}

// ── Auto-assign (F2.7) ───────────────────────────────────────────────

export interface AutoAssignResult {
    assigneeId: string | null
    teamId: string | null
}

/// หาเจ้าหน้าที่/ทีมเริ่มต้นจากหมวดหมู่บริการ — ปิดได้ที่ AppSetting `ticket.auto_assign`
export async function resolveAutoAssign(categoryId: string): Promise<AutoAssignResult> {
    const enabled = await getAppSetting<boolean>("ticket.auto_assign", true)
    if (!enabled) return { assigneeId: null, teamId: null }

    const category = await prisma.serviceCategory.findUnique({
        where: { id: categoryId },
        select: { defaultAssigneeId: true, defaultTeamId: true, parentId: true },
    })
    if (!category) return { assigneeId: null, teamId: null }

    // ถ้าหมวดย่อยไม่ได้ตั้งค่าไว้ ให้ไล่ขึ้นไปใช้ค่าของหมวดหลัก
    if (!category.defaultAssigneeId && !category.defaultTeamId && category.parentId) {
        const parent = await prisma.serviceCategory.findUnique({
            where: { id: category.parentId },
            select: { defaultAssigneeId: true, defaultTeamId: true },
        })
        return {
            assigneeId: parent?.defaultAssigneeId ?? null,
            teamId: parent?.defaultTeamId ?? null,
        }
    }

    return {
        assigneeId: category.defaultAssigneeId,
        teamId: category.defaultTeamId,
    }
}

// ── Audit log ────────────────────────────────────────────────────────

export interface ActivityInput {
    ticketId: string
    actorId: string
    action: TicketAction
    fromValue?: string | null
    toValue?: string | null
    note?: string | null
}

/// บันทึกความเคลื่อนไหวลง TicketActivity — เรียกทุกครั้งที่ Ticket เปลี่ยนแปลง
export async function logActivity(db: Db, input: ActivityInput) {
    return db.ticketActivity.create({
        data: {
            ticketId: input.ticketId,
            actorId: input.actorId,
            action: input.action,
            fromValue: input.fromValue ?? null,
            toValue: input.toValue ?? null,
            note: input.note ?? null,
        },
    })
}

// ── รูปแบบข้อมูลที่ API คืนให้ UI ────────────────────────────────────

const personSelect = { id: true, name: true, email: true, image: true } as const

/// ฟิลด์ของ Ticket ในหน้ารายการ (F1.3) — เบา ไม่ดึง description
export const ticketListSelect = {
    id: true,
    ticketNo: true,
    title: true,
    status: true,
    priority: true,
    impact: true,
    urgency: true,
    channel: true,
    createdAt: true,
    updatedAt: true,
    respondedAt: true,
    resolvedAt: true,
    closedAt: true,
    responseDueAt: true,
    resolutionDueAt: true,
    responseBreached: true,
    resolutionBreached: true,
    category: { select: { id: true, name: true, slug: true } },
    requester: { select: personSelect },
    assignee: { select: personSelect },
    team: { select: { id: true, name: true } },
    _count: { select: { comments: true } },
} satisfies Prisma.TicketSelect

/// ฟิลด์ของ Ticket ในหน้ารายละเอียด (F1.5)
export const ticketDetailSelect = {
    ...ticketListSelect,
    description: true,
    resolutionNote: true,
    departmentId: true,
    department: { select: { id: true, name: true } },
    requesterId: true,
    assigneeId: true,
    teamId: true,
    categoryId: true,
} satisfies Prisma.TicketSelect

export type TicketListRow = Prisma.TicketGetPayload<{ select: typeof ticketListSelect }>

// ── Service Catalog (F1.8) ───────────────────────────────────────────

/// ฟิลด์ของหมวดหมู่บริการที่ api/categories คืนให้ UI
export const categorySelect = {
    id: true,
    name: true,
    slug: true,
    parentId: true,
    description: true,
    defaultTeamId: true,
    defaultAssigneeId: true,
    active: true,
    sortOrder: true,
    defaultTeam: { select: { id: true, name: true } },
    defaultAssignee: { select: { id: true, name: true } },
    _count: { select: { tickets: true } },
} satisfies Prisma.ServiceCategorySelect

export type CategoryRow = Prisma.ServiceCategoryGetPayload<{ select: typeof categorySelect }>

// ── SLA indicator (F4.8) ─────────────────────────────────────────────

export interface TicketSla {
    status: SlaStatus
    ratio: number
    remainingMinutes: number
    /// อ้างถึงกำหนดเวลาใด — ยังไม่ตอบกลับดูที่ response, ตอบแล้วดูที่ resolution
    target: "response" | "resolution" | "done"
}

type SlaSource = {
    createdAt: Date
    respondedAt: Date | null
    resolvedAt: Date | null
    responseDueAt: Date | null
    resolutionDueAt: Date | null
    responseBreached: boolean
    resolutionBreached: boolean
    status: string
}

/// คำนวณสถานะ SLA ของ Ticket หนึ่งใบสำหรับแสดงไฟเขียว/เหลือง/แดง
export async function computeTicketSla(
    ticket: SlaSource,
    now: Date = new Date()
): Promise<TicketSla | null> {
    // ปิดงานแล้ว — ดูผลย้อนหลังจากธง breach ที่บันทึกไว้
    if (ticket.resolvedAt || ticket.status === "closed") {
        return {
            status: ticket.resolutionBreached ? "breached" : "on_time",
            ratio: 1,
            remainingMinutes: 0,
            target: "done",
        }
    }

    // ยังไม่ตอบกลับครั้งแรก → จับเวลาที่กำหนดตอบกลับ
    if (!ticket.respondedAt && ticket.responseDueAt) {
        const p = await getSlaProgress(ticket.createdAt, ticket.responseDueAt, now)
        return { ...p, target: "response" }
    }

    if (ticket.resolutionDueAt) {
        const p = await getSlaProgress(ticket.createdAt, ticket.resolutionDueAt, now)
        return { ...p, target: "resolution" }
    }

    return null
}

/// เติมสถานะ SLA ให้ทุกแถวในหน้ารายการ
export async function withSla<T extends SlaSource>(
    tickets: T[]
): Promise<(T & { sla: TicketSla | null })[]> {
    const now = new Date()
    return Promise.all(tickets.map(async (t) => ({ ...t, sla: await computeTicketSla(t, now) })))
}

/// ตั้งธง breach ให้ตรงกับเวลาปัจจุบัน (F4.7) — เรียกตอนอ่านรายการ
export async function syncBreachFlags(tickets: (SlaSource & { id: string })[]): Promise<void> {
    const now = new Date()
    const responseBreached: string[] = []
    const resolutionBreached: string[] = []

    for (const t of tickets) {
        if (!t.responseBreached && !t.respondedAt && t.responseDueAt && t.responseDueAt < now) {
            responseBreached.push(t.id)
        }
        if (!t.resolutionBreached && !t.resolvedAt && t.resolutionDueAt && t.resolutionDueAt < now) {
            resolutionBreached.push(t.id)
        }
    }

    if (responseBreached.length > 0) {
        await prisma.ticket.updateMany({
            where: { id: { in: responseBreached } },
            data: { responseBreached: true },
        })
        for (const t of tickets) {
            if (responseBreached.includes(t.id)) t.responseBreached = true
        }
    }
    if (resolutionBreached.length > 0) {
        await prisma.ticket.updateMany({
            where: { id: { in: resolutionBreached } },
            data: { resolutionBreached: true },
        })
        for (const t of tickets) {
            if (resolutionBreached.includes(t.id)) t.resolutionBreached = true
        }
    }
}

// ── Query builder ของหน้ารายการ (F1.3, F1.4, F1.11, F2.5) ───────────

/// ประกอบเงื่อนไข where — รวม row-level scope ตาม role ไว้ด้วยแล้ว (NFR3)
export function buildTicketWhere(q: ListTicketsQuery, user: AuthUser): Prisma.TicketWhereInput {
    const and: Prisma.TicketWhereInput[] = []

    // F1.4 — ผู้ที่ไม่ใช่เจ้าหน้าที่เห็นเฉพาะ Ticket ที่ตัวเองแจ้ง
    if (!isStaff(user)) and.push({ requesterId: user.id })

    if (q.q) {
        and.push({
            OR: [
                { title: { contains: q.q, mode: "insensitive" } },
                { description: { contains: q.q, mode: "insensitive" } },
                { ticketNo: { contains: q.q, mode: "insensitive" } },
            ],
        })
    }

    if (q.status.length > 0) and.push({ status: { in: q.status } })
    if (q.priority.length > 0) and.push({ priority: { in: q.priority } })
    if (q.channel.length > 0) and.push({ channel: { in: q.channel } })
    if (q.categoryId) and.push({ categoryId: q.categoryId })
    if (q.teamId) and.push({ teamId: q.teamId })
    if (q.requesterId) and.push({ requesterId: q.requesterId })

    if (q.assigneeId) {
        and.push(
            q.assigneeId === "unassigned" ? { assigneeId: null } : { assigneeId: q.assigneeId }
        )
    }

    // F4.11 — คิดจากเวลาจริงทุกครั้ง ไม่ได้อ่านธง breached ในตาราง (ดู lib/sla-service.ts)
    if (q.breached) and.push(breachWhere(q.breached))

    // ช่วงวันที่คิดตามปฏิทินไทยเสมอ — "2026-09-01" คือ 00:00 น. ตามเวลาไทย ไม่ใช่ UTC
    // (ก่อนหน้านี้ใช้ new Date("YYYY-MM-DD") ซึ่งเป็นเที่ยงคืน UTC = 07:00 น. ของไทย
    //  ทำให้ Ticket ที่แจ้งช่วงเช้ามืดของวันแรกหลุดออกจากผลลัพธ์)
    const from = q.from ? new Date(`${q.from}T00:00:00.000+07:00`) : null
    const to = q.to ? new Date(`${q.to}T23:59:59.999+07:00`) : null
    if (from && !Number.isNaN(from.getTime())) and.push({ createdAt: { gte: from } })
    if (to && !Number.isNaN(to.getTime())) and.push({ createdAt: { lte: to } })

    return and.length > 0 ? { AND: and } : {}
}

/// การเรียงลำดับระดับ SQL — คิวงานตาม F2.5 ต้องเรียง priority ต่อในหน่วยความจำ
export function buildTicketOrderBy(
    sort: ListTicketsQuery["sort"]
): Prisma.TicketOrderByWithRelationInput[] {
    switch (sort) {
        case "newest":
            return [{ createdAt: "desc" }]
        case "oldest":
            return [{ createdAt: "asc" }]
        case "due":
        case "queue":
        default:
            return [{ resolutionDueAt: { sort: "asc", nulls: "last" } }]
    }
}

/// เรียงคิวงานตาม Priority ในหน่วยความจำ — ใช้คู่กับ sort = "queue" (F2.5)
///
/// priority เก็บเป็น string จึงเรียงด้วย ORDER BY ตรงๆ ไม่ได้ ต้องแปลงเป็นน้ำหนักก่อน
export function sortByQueue<T extends { priority: string; resolutionDueAt: Date | null }>(
    rows: T[]
): T[] {
    const weight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    return [...rows].sort((a, b) => {
        const w = (weight[b.priority] ?? 0) - (weight[a.priority] ?? 0)
        if (w !== 0) return w
        const da = a.resolutionDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        const db = b.resolutionDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        return da - db
    })
}

// ── ตัวช่วยอื่น ───────────────────────────────────────────────────────

/// คำนวณ priority ใหม่พร้อมกำหนดเวลา เมื่อ Impact/Urgency เปลี่ยน (F2.4)
export async function recalculate(
    impact: string,
    urgency: string,
    categoryId: string,
    createdAt: Date
) {
    const priority = calculatePriority(impact, urgency)
    const due = await computeDueDates(priority, categoryId, createdAt)
    return { priority, ...due }
}
