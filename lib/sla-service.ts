// lib/sla-service.ts
// ตรรกะกลางของ SLA ที่ใช้ร่วมกันระหว่าง api/reports/sla และฟิลเตอร์ "เกินกำหนด" ของหน้ารายการ
//   - นิยาม "เกินกำหนด" ที่เป็นความจริงเดียวของทั้งระบบ (F4.7, F4.10, F4.11)
//   - รวมสถิติ % ตรงเวลา แยกตามมิติต่างๆ
// อ้างอิง docs/spec.md §8 ④
//
// ⚠️ ที่นี่ไม่ได้อ่านธง `responseBreached` / `resolutionBreached` ในตาราง แต่คำนวณจาก
//    เวลาจริงทุกครั้ง เพราะธงถูกตั้งตอน "อ่านรายการ" เท่านั้น (syncBreachFlags)
//    ใบที่ตอบกลับช้าแต่ไม่มีใครเปิดหน้ารายการในช่วงนั้น ธงจะยังเป็น false อยู่

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"

// ── วันที่ของปฏิทินวันหยุด ─────────────────────────────────────────────

/// คอลัมน์ `Holiday.date` เป็น @db.Date — ต้องสร้างเป็นเที่ยงคืน UTC ให้ตรงกับที่ seed ใช้
/// ไม่งั้นวันหยุดจะเลื่อนไป 1 วันเมื่อ server ตั้ง timezone เป็นเวลาไทย
export function utcDate(iso: string): Date {
    return new Date(`${iso}T00:00:00.000Z`)
}

/// "2026-01-01" จากค่า Date ที่อ่านมาจากคอลัมน์ @db.Date
export function isoDateOf(date: Date): string {
    return date.toISOString().slice(0, 10)
}

// ── นิยาม "เกินกำหนด" (F4.11) ────────────────────────────────────────

/// ชนิดของการเกินกำหนดที่ใช้กรองในหน้ารายการ
export const BREACH_FILTERS = ["response", "resolution", "any"] as const
export type BreachFilter = (typeof BREACH_FILTERS)[number]

/// เงื่อนไข Prisma ของ "เกินกำหนดตอบกลับ"
///   ① ยังไม่ตอบกลับ และเลยกำหนดมาแล้ว   ② ตอบกลับแล้วแต่ช้ากว่ากำหนด
function responseBreachWhere(now: Date): Prisma.TicketWhereInput {
    return {
        OR: [
            { respondedAt: null, responseDueAt: { lt: now } },
            // เทียบสองคอลัมน์ในแถวเดียวกันด้วย field reference ของ Prisma
            { respondedAt: { gt: prisma.ticket.fields.responseDueAt } },
        ],
    }
}

/// เงื่อนไข Prisma ของ "เกินกำหนดแก้ไข"
function resolutionBreachWhere(now: Date): Prisma.TicketWhereInput {
    return {
        OR: [
            { resolvedAt: null, resolutionDueAt: { lt: now } },
            { resolvedAt: { gt: prisma.ticket.fields.resolutionDueAt } },
        ],
    }
}

export function breachWhere(kind: BreachFilter, now: Date = new Date()): Prisma.TicketWhereInput {
    switch (kind) {
        case "response":
            return responseBreachWhere(now)
        case "resolution":
            return resolutionBreachWhere(now)
        default:
            return { OR: [responseBreachWhere(now), resolutionBreachWhere(now)] }
    }
}

// ── การประเมินผลรายใบ (F4.10) ────────────────────────────────────────

/// ฟิลด์ขั้นต่ำที่ใช้ตัดสินผล SLA ของ Ticket หนึ่งใบ
export interface SlaJudgeSource {
    respondedAt: Date | null
    resolvedAt: Date | null
    responseDueAt: Date | null
    resolutionDueAt: Date | null
}

/// ผลของใบเดียว — `measured` = รู้ผลแล้ว (ทำได้ทันหรือเลยกำหนดไปแล้ว)
/// ใบที่ยังไม่ถึงกำหนดและยังไม่ทำ ถือว่ายังไม่รู้ผล จึงไม่นำมาคิด %
export interface SlaOutcome {
    responseMeasured: boolean
    responseMet: boolean
    resolutionMeasured: boolean
    resolutionMet: boolean
}

function judge(doneAt: Date | null, dueAt: Date | null, now: Date) {
    if (!dueAt) return { measured: false, met: false }
    if (doneAt) return { measured: true, met: doneAt <= dueAt }
    // ยังไม่ได้ทำ — รู้ผลก็ต่อเมื่อเลยกำหนดมาแล้ว (นับเป็นเกินกำหนด)
    return dueAt < now ? { measured: true, met: false } : { measured: false, met: false }
}

export function evaluateTicketSla(t: SlaJudgeSource, now: Date = new Date()): SlaOutcome {
    const res = judge(t.respondedAt, t.responseDueAt, now)
    const fix = judge(t.resolvedAt, t.resolutionDueAt, now)
    return {
        responseMeasured: res.measured,
        responseMet: res.met,
        resolutionMeasured: fix.measured,
        resolutionMet: fix.met,
    }
}

// ── การรวมสถิติ ──────────────────────────────────────────────────────

/// สถิติหนึ่งกลุ่ม — `rate` เป็นเปอร์เซ็นต์ 0–100 (null = ยังไม่มีใบที่รู้ผล)
export interface SlaStat {
    total: number
    responseMeasured: number
    responseMet: number
    responseBreached: number
    responseRate: number | null
    resolutionMeasured: number
    resolutionMet: number
    resolutionBreached: number
    resolutionRate: number | null
}

export interface SlaGroup extends SlaStat {
    key: string
    label: string
}

export function emptyStat(): SlaStat {
    return {
        total: 0,
        responseMeasured: 0,
        responseMet: 0,
        responseBreached: 0,
        responseRate: null,
        resolutionMeasured: 0,
        resolutionMet: 0,
        resolutionBreached: 0,
        resolutionRate: null,
    }
}

export function accumulate(stat: SlaStat, outcome: SlaOutcome): void {
    stat.total += 1
    if (outcome.responseMeasured) {
        stat.responseMeasured += 1
        if (outcome.responseMet) stat.responseMet += 1
        else stat.responseBreached += 1
    }
    if (outcome.resolutionMeasured) {
        stat.resolutionMeasured += 1
        if (outcome.resolutionMet) stat.resolutionMet += 1
        else stat.resolutionBreached += 1
    }
}

/// ปัดเป็นทศนิยม 1 ตำแหน่ง — ทำครั้งเดียวตอนปิดยอด
function rate(met: number, measured: number): number | null {
    return measured > 0 ? Math.round((met / measured) * 1000) / 10 : null
}

export function finalize(stat: SlaStat): SlaStat {
    stat.responseRate = rate(stat.responseMet, stat.responseMeasured)
    stat.resolutionRate = rate(stat.resolutionMet, stat.resolutionMeasured)
    return stat
}

/// ตัวช่วยจัดกลุ่ม — เก็บ label ของคีย์ไว้ด้วยเพื่อไม่ต้อง join ซ้ำตอนคืนค่า
export class StatGrouper {
    private readonly groups = new Map<string, SlaGroup>()

    add(key: string, label: string, outcome: SlaOutcome): void {
        let g = this.groups.get(key)
        if (!g) {
            g = { key, label, ...emptyStat() }
            this.groups.set(key, g)
        }
        accumulate(g, outcome)
    }

    /// คืนผลที่ปิดยอดแล้ว — เรียงตามลำดับที่กำหนด หรือตามจำนวนใบมาก→น้อย
    result(order?: (a: SlaGroup, b: SlaGroup) => number): SlaGroup[] {
        const list = [...this.groups.values()].map((g) => finalize(g) as SlaGroup)
        return list.sort(order ?? ((a, b) => b.total - a.total))
    }
}

// ── รูปแบบข้อมูลที่ api/sla-policies คืนให้ UI ────────────────────────

export const slaPolicySelect = {
    id: true,
    name: true,
    priority: true,
    categoryId: true,
    responseMinutes: true,
    resolutionMinutes: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.SlaPolicySelect

export type SlaPolicyRow = Prisma.SlaPolicyGetPayload<{ select: typeof slaPolicySelect }>
