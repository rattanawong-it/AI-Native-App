// lib/sla-schema.ts
// Schema ตรวจความถูกต้องของ payload ในกลุ่ม SLA (NFR2)
//   api/sla-policies · api/business-hours · api/holidays · api/reports/sla
// ใช้ zod v4 — ข้อความ error เป็นภาษาไทยเพื่อส่งกลับให้ผู้ใช้ได้ตรงๆ
// อ้างอิง docs/spec.md §8 ④ (F4.1–F4.3, F4.10)

import { z } from "zod"
import { PRIORITY_LEVELS } from "@/lib/priority"
import { parseTimeToMinutes } from "@/lib/business-hours"

const priorityEnum = z.enum(PRIORITY_LEVELS, { message: "ระดับความสำคัญไม่ถูกต้อง" })

/// นาทีทำการ — 1 วันทำการ = 480 นาที เพดาน 100,000 นาที (~200 วันทำการ)
const businessMinutes = z.coerce
    .number({ message: "กรุณากรอกเป็นตัวเลข" })
    .int("กรอกเป็นจำนวนเต็มนาที")
    .min(1, "ต้องมากกว่า 0 นาที")
    .max(100000, "ค่าสูงเกินกำหนด (ไม่เกิน 100,000 นาทีทำการ)")

/// เวลาแบบ 24 ชั่วโมง "08:30"
const timeString = z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาต้องเป็น HH:MM เช่น 08:30")

/// วันที่แบบ ISO "2026-01-01" — ตรงกับคอลัมน์ @db.Date ของ Holiday
const isoDate = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)), "วันที่ไม่ถูกต้อง")

// ── SLA Policy (F4.1) ────────────────────────────────────────────────

const slaPolicyFields = z.object({
    name: z.string().trim().min(2, "กรุณากรอกชื่อนโยบาย").max(120, "ชื่อยาวเกิน 120 ตัวอักษร"),
    priority: priorityEnum,
    /// null = ใช้กับทุกหมวดหมู่ (นโยบายรวม)
    categoryId: z.string().min(1).nullish(),
    responseMinutes: businessMinutes,
    resolutionMinutes: businessMinutes,
    active: z.boolean().default(true),
})

/// เวลาแก้ไขต้องไม่สั้นกว่าเวลาตอบกลับ — กันตั้งค่าที่เป็นไปไม่ได้
function checkOrder(v: { responseMinutes?: number; resolutionMinutes?: number }): boolean {
    if (v.responseMinutes === undefined || v.resolutionMinutes === undefined) return true
    return v.resolutionMinutes >= v.responseMinutes
}

const ORDER_ISSUE = {
    path: ["resolutionMinutes"],
    message: "เวลาแก้ไขต้องไม่น้อยกว่าเวลาตอบกลับ",
}

export const createSlaPolicySchema = slaPolicyFields.refine(checkOrder, ORDER_ISSUE)
export type CreateSlaPolicyInput = z.infer<typeof createSlaPolicySchema>

export const updateSlaPolicySchema = slaPolicyFields
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
    .refine(checkOrder, ORDER_ISSUE)
export type UpdateSlaPolicyInput = z.infer<typeof updateSlaPolicySchema>

// ── เวลาทำการ (F4.2) ─────────────────────────────────────────────────

const businessHourItem = z
    .object({
        dayOfWeek: z.coerce.number().int().min(0, "วันในสัปดาห์ไม่ถูกต้อง").max(6, "วันในสัปดาห์ไม่ถูกต้อง"),
        startTime: timeString,
        endTime: timeString,
        isWorkingDay: z.boolean().default(true),
    })
    .refine(
        (v) => !v.isWorkingDay || parseTimeToMinutes(v.endTime) > parseTimeToMinutes(v.startTime),
        { path: ["endTime"], message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" }
    )

/// บันทึกทั้งสัปดาห์ในครั้งเดียว — หน้า admin ส่งมาครบทุกวันที่แก้
export const updateBusinessHoursSchema = z
    .object({ hours: z.array(businessHourItem).min(1, "ไม่มีข้อมูลที่ต้องการบันทึก").max(7) })
    .refine((v) => new Set(v.hours.map((h) => h.dayOfWeek)).size === v.hours.length, {
        path: ["hours"],
        message: "มีวันซ้ำกันในรายการ",
    })
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>

// ── วันหยุด (F4.3) ───────────────────────────────────────────────────

export const createHolidaySchema = z.object({
    date: isoDate,
    name: z.string().trim().min(2, "กรุณากรอกชื่อวันหยุด").max(160, "ชื่อยาวเกิน 160 ตัวอักษร"),
    /// true = หยุดวันเดิมทุกปี (วันที่ตายตัว เช่น 1 ม.ค.)
    isRecurring: z.boolean().default(false),
})
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>

export const updateHolidaySchema = createHolidaySchema
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>

/// นำเข้าวันหยุดทั้งปีในครั้งเดียว (F4.3)
export const importHolidaysSchema = z.object({
    items: z
        .array(createHolidaySchema)
        .min(1, "ไม่มีรายการวันหยุดที่จะนำเข้า")
        .max(120, "นำเข้าได้ครั้งละไม่เกิน 120 วัน"),
    /// true = ทับชื่อของวันที่ที่มีอยู่แล้ว · false = ข้ามวันที่ซ้ำ
    overwrite: z.boolean().default(false),
})
export type ImportHolidaysInput = z.infer<typeof importHolidaysSchema>

// ── รายงาน SLA (F4.10) ───────────────────────────────────────────────

export const slaReportQuerySchema = z.object({
    /// ช่วงวันที่ "แจ้ง" ของ Ticket ที่นำมาคิด (ค่าเริ่มต้น = 30 วันย้อนหลัง)
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: z.string().min(1).optional(),
    teamId: z.string().min(1).optional(),
    assigneeId: z.string().min(1).optional(),
    priority: z
        .string()
        .optional()
        .transform((raw) =>
            (raw ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter((s): s is (typeof PRIORITY_LEVELS)[number] =>
                    (PRIORITY_LEVELS as readonly string[]).includes(s)
                )
        ),
})
export type SlaReportQuery = z.infer<typeof slaReportQuerySchema>

export { priorityEnum, isoDate, timeString }
