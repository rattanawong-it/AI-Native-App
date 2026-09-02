// lib/thai-date.ts
// ตัวช่วยเรื่อง "วันตามปฏิทินไทย" ที่ใช้ร่วมกันระหว่างรายงาน SLA และ Time Log
//
// เหตุผลที่ต้องมีไฟล์นี้: ค่าเวลาทุกตัวใน DB เป็น UTC แต่ผู้ใช้คิดเป็นวันตามเวลาไทย (UTC+7)
// ถ้าใช้ `new Date("2026-09-01")` ตรงๆ จะได้เที่ยงคืน **UTC** = 07:00 น. ของไทย ทำให้ข้อมูล
// ช่วง 00:00–07:00 ของวันแรกหลุดออกจากผลลัพธ์ (บั๊กที่เจอจริงในหน้ารายการ Ticket ของ Phase 1)
//
// ประเทศไทยเป็น UTC+7 ตลอดปี ไม่มี daylight saving จึงบวกออฟเซ็ตคงที่ได้

/// ออฟเซ็ตเวลาไทยเป็นมิลลิวินาที
const TH_OFFSET_MS = 7 * 60 * 60 * 1000

/// "2026-09-01" → ต้นวันตามเวลาไทย (00:00:00.000 +07:00)
export function startOfThaiDay(iso: string): Date {
    return new Date(`${iso}T00:00:00.000+07:00`)
}

/// "2026-09-01" → สิ้นสุดวันตามเวลาไทย (23:59:59.999 +07:00) — ใช้เป็นปลายทางแบบรวมทั้งวัน
export function endOfThaiDay(iso: string): Date {
    return new Date(`${iso}T23:59:59.999+07:00`)
}

/// วันที่แบบ ISO ของ "วันนี้" ตามเวลาไทย · `offsetDays` ติดลบได้เพื่อย้อนหลัง
export function thaiToday(offsetDays = 0): string {
    const d = new Date(Date.now() + TH_OFFSET_MS)
    d.setUTCDate(d.getUTCDate() + offsetDays)
    return d.toISOString().slice(0, 10)
}

/// คีย์วันตามเวลาไทยของค่า Date ใดๆ — "2026-09-01"
export function thaiDayKey(date: Date): string {
    return new Date(date.getTime() + TH_OFFSET_MS).toISOString().slice(0, 10)
}

/// คีย์เดือนตามเวลาไทย — "2026-09"
export function thaiMonthKey(date: Date): string {
    return new Date(date.getTime() + TH_OFFSET_MS).toISOString().slice(0, 7)
}

/// ป้ายเดือนภาษาไทย — "ก.ย. 2569"
export function thaiMonthLabel(date: Date): string {
    return date.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        month: "short",
        year: "numeric",
    })
}

/// เลื่อนวันที่ ISO ไปข้างหน้า/ข้างหลังตามจำนวนวัน — "2026-09-01" + 6 = "2026-09-07"
export function addThaiDays(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

/// วันจันทร์ของสัปดาห์ที่วันที่นั้นอยู่ (สัปดาห์เริ่มวันจันทร์ตามที่ราชการไทยใช้)
export function startOfThaiWeek(iso: string): string {
    const d = new Date(`${iso}T00:00:00.000Z`)
    // getUTCDay(): 0 = อาทิตย์ → ถอยกลับ 6 วัน · 1 = จันทร์ → ถอย 0 วัน
    const back = (d.getUTCDay() + 6) % 7
    return addThaiDays(iso, -back)
}

/// วันที่ 1 ของเดือนที่วันที่นั้นอยู่
export function startOfThaiMonth(iso: string): string {
    return `${iso.slice(0, 7)}-01`
}

/// วันสุดท้ายของเดือนที่วันที่นั้นอยู่
export function endOfThaiMonth(iso: string): string {
    const d = new Date(`${iso.slice(0, 7)}-01T00:00:00.000Z`)
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCDate(0)
    return d.toISOString().slice(0, 10)
}
