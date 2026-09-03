// lib/report-schema.ts
// Validate query ของรายงานประจำเดือน / ไตรมาส + ตีความ "ช่วงเวลา" ให้เป็นวันที่จริง (F7.15)
// อ้างอิง docs/spec.md §8 ⑦C และ NFR2
//
// ⚠️ ไตรมาสในไฟล์นี้เป็น **ไตรมาสตามปฏิทิน** (Q1 = ม.ค.–มี.ค.) ไม่ใช่ไตรมาสปีงบประมาณ
//    ป้ายกำกับจึงเขียนช่วงเดือนกำกับไว้เสมอ เพื่อไม่ให้ผู้อ่านรายงานเข้าใจคลาดเคลื่อน

import { z } from "zod"
import { PERIOD_TYPES, type ReportPeriod } from "@/lib/report-types"
import { addThaiDays, endOfThaiMonth, thaiToday } from "@/lib/thai-date"

const isoDate = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)), "วันที่ไม่ถูกต้อง")

const monthKey = z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "รูปแบบเดือนต้องเป็น YYYY-MM")

const quarterKey = z
    .string()
    .trim()
    .regex(/^\d{4}-Q[1-4]$/, "รูปแบบไตรมาสต้องเป็น YYYY-Q1 ถึง YYYY-Q4")

/// query ของทุกรายงานที่เลือกช่วงเวลาได้
export const reportPeriodQuerySchema = z.object({
    type: z.enum(PERIOD_TYPES).default("month"),
    /// ใช้เมื่อ type = month — ค่าเริ่มต้นคือเดือนปัจจุบัน
    month: monthKey.optional(),
    /// ใช้เมื่อ type = quarter — ค่าเริ่มต้นคือไตรมาสปัจจุบัน
    quarter: quarterKey.optional(),
    /// ใช้เมื่อ type = custom
    from: isoDate.optional(),
    to: isoDate.optional(),
})

export type ReportPeriodQuery = z.infer<typeof reportPeriodQuerySchema>

// ── ป้ายกำกับภาษาไทย ─────────────────────────────────────────────────

const THAI_MONTHS = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
]

const THAI_MONTHS_SHORT = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
]

/// ค.ศ. → พ.ศ.
function buddhistYear(year: number): number {
    return year + 543
}

/// "2026-09" → "กันยายน 2569"
function monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number)
    return `${THAI_MONTHS[m - 1]} ${buddhistYear(y)}`
}

/// "2026-Q3" → "ไตรมาส 3/2569 (ก.ค.–ก.ย.)"
function quarterLabel(key: string): string {
    const [yRaw, qRaw] = key.split("-Q")
    const y = Number(yRaw)
    const q = Number(qRaw)
    const first = (q - 1) * 3
    return `ไตรมาส ${q}/${buddhistYear(y)} (${THAI_MONTHS_SHORT[first]}–${THAI_MONTHS_SHORT[first + 2]})`
}

/// "2026-09-01" ถึง "2026-09-30" → "1 ก.ย. 2569 – 30 ก.ย. 2569"
function customLabel(from: string, to: string): string {
    const fmt = (iso: string) => {
        const [y, m, d] = iso.split("-").map(Number)
        return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${buddhistYear(y)}`
    }
    return `${fmt(from)} – ${fmt(to)}`
}

// ── ตีความช่วงเวลา ───────────────────────────────────────────────────

/// เดือนปัจจุบันตามปฏิทินไทย — "2026-09"
export function currentMonthKey(): string {
    return thaiToday().slice(0, 7)
}

/// ไตรมาสปัจจุบันตามปฏิทินไทย — "2026-Q3"
export function currentQuarterKey(): string {
    const today = thaiToday()
    const year = today.slice(0, 4)
    const month = Number(today.slice(5, 7))
    return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
}

/// แปลง query ที่ผ่าน validate แล้วเป็นช่วงวันที่จริง
/// คืน `null` เมื่อ custom มีวันที่ไม่ครบหรือกลับหัวกลับหาง (ให้ route ตอบ 400)
export function resolvePeriod(query: ReportPeriodQuery): ReportPeriod | null {
    if (query.type === "month") {
        const key = query.month ?? currentMonthKey()
        const from = `${key}-01`
        return { type: "month", from, to: endOfThaiMonth(from), label: monthLabel(key) }
    }

    if (query.type === "quarter") {
        const key = query.quarter ?? currentQuarterKey()
        const [yRaw, qRaw] = key.split("-Q")
        const firstMonth = (Number(qRaw) - 1) * 3 + 1
        const from = `${yRaw}-${String(firstMonth).padStart(2, "0")}-01`
        const lastMonthStart = `${yRaw}-${String(firstMonth + 2).padStart(2, "0")}-01`
        return {
            type: "quarter",
            from,
            to: endOfThaiMonth(lastMonthStart),
            label: quarterLabel(key),
        }
    }

    // custom — ต้องระบุครบทั้งสองฝั่ง
    if (!query.from || !query.to) return null
    if (query.from > query.to) return null
    return {
        type: "custom",
        from: query.from,
        to: query.to,
        label: customLabel(query.from, query.to),
    }
}

/// ช่วงก่อนหน้าที่ยาวเท่ากัน — ใช้เทียบตัวเลขว่าดีขึ้นหรือแย่ลง
///
/// เดือน/ไตรมาสเลื่อนกลับตามปฏิทิน (จะได้เทียบ ก.ย. กับ ส.ค. ไม่ใช่ "30 วันก่อนหน้า")
/// ส่วน custom ถอยหลังไปเท่ากับจำนวนวันของช่วงที่เลือก
export function previousPeriod(period: ReportPeriod): ReportPeriod {
    if (period.type === "month") {
        const [y, m] = period.from.split("-").map(Number)
        const prevMonth = m === 1 ? 12 : m - 1
        const prevYear = m === 1 ? y - 1 : y
        const key = `${prevYear}-${String(prevMonth).padStart(2, "0")}`
        const from = `${key}-01`
        return { type: "month", from, to: endOfThaiMonth(from), label: monthLabel(key) }
    }

    if (period.type === "quarter") {
        const [y, m] = period.from.split("-").map(Number)
        const q = Math.floor((m - 1) / 3) + 1
        const prevQ = q === 1 ? 4 : q - 1
        const prevYear = q === 1 ? y - 1 : y
        const key = `${prevYear}-Q${prevQ}`
        const firstMonth = (prevQ - 1) * 3 + 1
        const from = `${prevYear}-${String(firstMonth).padStart(2, "0")}-01`
        const lastMonthStart = `${prevYear}-${String(firstMonth + 2).padStart(2, "0")}-01`
        return {
            type: "quarter",
            from,
            to: endOfThaiMonth(lastMonthStart),
            label: quarterLabel(key),
        }
    }

    const days = daysBetween(period.from, period.to) + 1
    const to = addThaiDays(period.from, -1)
    const from = addThaiDays(to, -(days - 1))
    return { type: "custom", from, to, label: customLabel(from, to) }
}

/// จำนวนวันระหว่างสองวันที่ (ไม่รวมวันเริ่ม — "2026-09-01" ถึง "2026-09-30" = 29)
export function daysBetween(from: string, to: string): number {
    const a = Date.parse(`${from}T00:00:00.000Z`)
    const b = Date.parse(`${to}T00:00:00.000Z`)
    return Math.round((b - a) / 86_400_000)
}
