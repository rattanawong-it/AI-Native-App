// lib/business-hours.ts
// คำนวณกำหนดเวลา SLA ตาม "เวลาทำการ" — ข้ามนอกเวลาทำการ เสาร์-อาทิตย์ และวันหยุดราชการ
// อ้างอิง docs/spec.md §3 ข้อ 5, F0.9, F4.4
//
// ทั้งไฟล์ทำงานบนเวลาไทย (Asia/Bangkok, UTC+7 ไม่มี DST) โดยแปลงเป็น
// "นาทีนับจาก epoch ตามเวลาไทย" เพื่อให้คำนวณได้ตรงไม่ว่า server จะตั้ง timezone ใด

import { prisma } from "@/lib/prisma"

/// ประเทศไทยเป็น UTC+7 ตลอดปี ไม่มี daylight saving
const BKK_OFFSET_MIN = 7 * 60

const MIN_PER_DAY = 1440

/// เวลาทำการของวันหนึ่ง (หน่วยเป็นนาทีนับจากเที่ยงคืน)
interface WorkWindow {
    start: number
    end: number
}

/// ปฏิทินทำการที่ใช้คำนวณ — โหลดจาก DB แล้ว cache ไว้
export interface BusinessCalendar {
    /// index 0–6 (อาทิตย์–เสาร์) → ช่วงเวลาทำการ หรือ null ถ้าเป็นวันหยุดประจำสัปดาห์
    week: (WorkWindow | null)[]
    /// วันหยุดแบบระบุปี — "YYYY-MM-DD"
    holidays: Set<string>
    /// วันหยุดที่เกิดซ้ำทุกปี — "MM-DD"
    recurringHolidays: Set<string>
}

// ── การแปลงเวลา ──────────────────────────────────────────────────────

/// แปลง Date → นาทีนับจาก epoch ตามเวลาไทย
function toBkkMinutes(date: Date): number {
    return Math.floor(date.getTime() / 60000) + BKK_OFFSET_MIN
}

/// แปลงนาทีตามเวลาไทย → Date
function fromBkkMinutes(minutes: number): Date {
    return new Date((minutes - BKK_OFFSET_MIN) * 60000)
}

/// เลขวันที่นับจาก epoch (ตามเวลาไทย)
function dayIndexOf(bkkMinutes: number): number {
    return Math.floor(bkkMinutes / MIN_PER_DAY)
}

/// วันในสัปดาห์ของ day index — epoch day 0 (1 ม.ค. 1970) เป็นวันพฤหัสบดี = 4
function dayOfWeekOf(dayIndex: number): number {
    return ((dayIndex % 7) + 4 + 7) % 7
}

/// คีย์วันที่ "YYYY-MM-DD" ของ day index
function dateKeyOf(dayIndex: number): string {
    return new Date(dayIndex * 86400000).toISOString().slice(0, 10)
}

/// แปลง "08:30" → 510 นาที
export function parseTimeToMinutes(time: string): number {
    const [h, m] = time.split(":").map((v) => Number(v))
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
    return h * 60 + m
}

// ── การโหลดปฏิทิน ────────────────────────────────────────────────────

/// ค่าเริ่มต้นเมื่อยังไม่ได้ตั้งค่าใน DB — จันทร์–ศุกร์ ตาม env
function defaultCalendar(): BusinessCalendar {
    const start = parseTimeToMinutes(process.env.DEFAULT_WORK_START || "08:30")
    const end = parseTimeToMinutes(process.env.DEFAULT_WORK_END || "16:30")
    return {
        week: [null, { start, end }, { start, end }, { start, end }, { start, end }, { start, end }, null],
        holidays: new Set(),
        recurringHolidays: new Set(),
    }
}

let cache: { data: BusinessCalendar; expiresAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

/// โหลด BusinessHour + Holiday จาก DB (cache 5 นาที)
export async function getBusinessCalendar(force = false): Promise<BusinessCalendar> {
    if (!force && cache && cache.expiresAt > Date.now()) return cache.data

    const fallback = defaultCalendar()
    try {
        const [hours, holidays] = await Promise.all([
            prisma.businessHour.findMany(),
            prisma.holiday.findMany(),
        ])

        const week: (WorkWindow | null)[] = hours.length > 0 ? [null, null, null, null, null, null, null] : fallback.week
        for (const h of hours) {
            if (!h.isWorkingDay) continue
            const start = parseTimeToMinutes(h.startTime)
            const end = parseTimeToMinutes(h.endTime)
            if (end > start) week[h.dayOfWeek] = { start, end }
        }

        const data: BusinessCalendar = {
            week,
            holidays: new Set(
                holidays.filter((h) => !h.isRecurring).map((h) => h.date.toISOString().slice(0, 10))
            ),
            recurringHolidays: new Set(
                holidays.filter((h) => h.isRecurring).map((h) => h.date.toISOString().slice(5, 10))
            ),
        }

        cache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
        return data
    } catch (error) {
        // ถ้า DB ยังไม่ถูก migrate หรือเชื่อมต่อไม่ได้ ให้ใช้ค่าเริ่มต้นแทนที่จะพัง
        console.error("business-hours: โหลดปฏิทินทำการไม่สำเร็จ ใช้ค่าเริ่มต้นแทน", error)
        return fallback
    }
}

/// ล้าง cache — เรียกหลังแก้ BusinessHour / Holiday ในหน้า admin
export function invalidateBusinessCalendar(): void {
    cache = null
}

// ── ตรรกะหลัก ────────────────────────────────────────────────────────

/// ช่วงเวลาทำการของวันนั้น — null ถ้าเป็นวันหยุดสุดสัปดาห์หรือวันหยุดราชการ
function windowOf(dayIndex: number, cal: BusinessCalendar): WorkWindow | null {
    const key = dateKeyOf(dayIndex)
    if (cal.holidays.has(key)) return null
    if (cal.recurringHolidays.has(key.slice(5))) return null
    return cal.week[dayOfWeekOf(dayIndex)] ?? null
}

/// วันนี้เป็นวันทำการหรือไม่
export async function isWorkingDay(date: Date, cal?: BusinessCalendar): Promise<boolean> {
    const c = cal ?? (await getBusinessCalendar())
    return windowOf(dayIndexOf(toBkkMinutes(date)), c) !== null
}

/// ขณะนี้อยู่ในเวลาทำการหรือไม่
export async function isWithinBusinessHours(date: Date, cal?: BusinessCalendar): Promise<boolean> {
    const c = cal ?? (await getBusinessCalendar())
    const bkk = toBkkMinutes(date)
    const w = windowOf(dayIndexOf(bkk), c)
    if (!w) return false
    const mod = bkk % MIN_PER_DAY
    return mod >= w.start && mod < w.end
}

/// จำนวนวันสูงสุดที่ยอมให้ไล่หา (กันลูปไม่รู้จบเมื่อไม่มีวันทำการเลย)
const MAX_DAYS = 3650

/// บวก "นาทีทำการ" จากเวลาที่กำหนด — ข้ามนอกเวลาทำการและวันหยุดให้อัตโนมัติ
///
/// ถ้า `from` อยู่นอกเวลาทำการ จะเลื่อนไปเริ่มนับที่ต้นเวลาทำการถัดไปก่อน
export async function addBusinessMinutes(
    from: Date,
    minutes: number,
    cal?: BusinessCalendar
): Promise<Date> {
    const c = cal ?? (await getBusinessCalendar())
    let remaining = Math.max(0, Math.round(minutes))

    const bkk = toBkkMinutes(from)
    let day = dayIndexOf(bkk)
    let mod = bkk % MIN_PER_DAY

    for (let i = 0; i < MAX_DAYS; i++) {
        const w = windowOf(day, c)
        if (w) {
            const cursor = Math.max(mod, w.start)
            if (cursor < w.end) {
                const available = w.end - cursor
                if (remaining <= available) {
                    return fromBkkMinutes(day * MIN_PER_DAY + cursor + remaining)
                }
                remaining -= available
            }
        }
        day += 1
        mod = 0
    }

    // ไม่ควรเกิดขึ้น — แปลว่าปฏิทินไม่มีวันทำการเลย
    throw new Error("business-hours: ไม่พบวันทำการในช่วง 10 ปีข้างหน้า กรุณาตรวจสอบการตั้งค่าเวลาทำการ")
}

/// นับ "นาทีทำการ" ระหว่างสองเวลา (ถ้า to < from จะได้ 0)
export async function businessMinutesBetween(
    from: Date,
    to: Date,
    cal?: BusinessCalendar
): Promise<number> {
    const c = cal ?? (await getBusinessCalendar())
    const startMin = toBkkMinutes(from)
    const endMin = toBkkMinutes(to)
    if (endMin <= startMin) return 0

    let total = 0
    const lastDay = dayIndexOf(endMin)
    for (let day = dayIndexOf(startMin); day <= lastDay; day++) {
        const w = windowOf(day, c)
        if (!w) continue
        const dayStart = day * MIN_PER_DAY
        const overlapStart = Math.max(startMin, dayStart + w.start)
        const overlapEnd = Math.min(endMin, dayStart + w.end)
        if (overlapEnd > overlapStart) total += overlapEnd - overlapStart
    }
    return total
}

// ── SLA helper ───────────────────────────────────────────────────────

/// กำหนดเวลาตอบกลับ + แก้ไข ที่คำนวณจากเวลาทำการ (F4.5)
export interface SlaDueDates {
    responseDueAt: Date
    resolutionDueAt: Date
}

export async function calculateDueDates(
    from: Date,
    responseMinutes: number,
    resolutionMinutes: number,
    cal?: BusinessCalendar
): Promise<SlaDueDates> {
    const c = cal ?? (await getBusinessCalendar())
    const [responseDueAt, resolutionDueAt] = await Promise.all([
        addBusinessMinutes(from, responseMinutes, c),
        addBusinessMinutes(from, resolutionMinutes, c),
    ])
    return { responseDueAt, resolutionDueAt }
}

/// สถานะ SLA สำหรับแสดงไฟเขียว/เหลือง/แดง (F4.8)
export type SlaStatus = "on_time" | "at_risk" | "breached"

export interface SlaProgress {
    status: SlaStatus
    /// สัดส่วนเวลาที่ใช้ไปแล้ว 0–1 (เกิน 1 = breach)
    ratio: number
    /// นาทีทำการที่เหลือ (ติดลบ = เกินกำหนด)
    remainingMinutes: number
}

/// คำนวณความคืบหน้าของ SLA — at-risk เมื่อใช้เวลาเกิน 75% ตาม spec §F4.8
export async function getSlaProgress(
    startedAt: Date,
    dueAt: Date,
    now: Date = new Date(),
    cal?: BusinessCalendar
): Promise<SlaProgress> {
    const c = cal ?? (await getBusinessCalendar())
    const total = await businessMinutesBetween(startedAt, dueAt, c)
    const used = await businessMinutesBetween(startedAt, now, c)

    if (now > dueAt) {
        const over = await businessMinutesBetween(dueAt, now, c)
        return { status: "breached", ratio: 1, remainingMinutes: -over }
    }

    const ratio = total > 0 ? used / total : 0
    return {
        status: ratio > 0.75 ? "at_risk" : "on_time",
        ratio,
        remainingMinutes: total - used,
    }
}

/// แปลงนาทีทำการเป็นข้อความไทยสั้นๆ เช่น "เหลือ 1 วัน 2 ชม." (F4.9)
export function formatBusinessDuration(minutes: number, hoursPerDay = 8): string {
    const abs = Math.abs(Math.round(minutes))
    const minPerDay = hoursPerDay * 60

    const days = Math.floor(abs / minPerDay)
    const hours = Math.floor((abs % minPerDay) / 60)
    const mins = abs % 60

    const parts: string[] = []
    if (days > 0) parts.push(`${days} วัน`)
    if (hours > 0) parts.push(`${hours} ชม.`)
    if (parts.length === 0 || (days === 0 && mins > 0)) parts.push(`${mins} นาที`)

    return parts.join(" ")
}
