// lib/worklog-schema.ts
// Schema ตรวจความถูกต้องของ payload ในกลุ่ม My Work / To-do / Time Log (NFR2)
//   api/todos · api/worklogs · api/worklogs/summary · api/my-work · api/settings
// ใช้ zod v4 — ข้อความ error เป็นภาษาไทยเพื่อส่งกลับให้ผู้ใช้ได้ตรงๆ
// อ้างอิง docs/spec.md §8 ③ (F3.1–F3.8) และ §5.3

import { z } from "zod"
import { PRIORITY_LEVELS } from "@/lib/priority"

const priorityEnum = z.enum(PRIORITY_LEVELS, { message: "ระดับความสำคัญไม่ถูกต้อง" })

/// วันที่แบบ ISO "2026-09-01" — ตรงกับคอลัมน์ @db.Date ของ WorkLog.workDate
const isoDate = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)), "วันที่ไม่ถูกต้อง")

/// วันที่ + เวลา (กำหนดส่งของงานส่วนตัว) — รับได้ทั้ง "2026-09-01" และ ISO เต็ม
const isoDateTime = z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v.length === 10 ? `${v}T23:59:59.999+07:00` : v)), {
        message: "รูปแบบวันที่ไม่ถูกต้อง",
    })
    .transform((v) => new Date(v.length === 10 ? `${v}T23:59:59.999+07:00` : v))

// ── งานส่วนตัว TodoItem (F3.3, F3.4) ─────────────────────────────────

export const createTodoSchema = z.object({
    title: z
        .string()
        .trim()
        .min(2, "กรุณากรอกหัวข้องานอย่างน้อย 2 ตัวอักษร")
        .max(200, "หัวข้อยาวเกิน 200 ตัวอักษร"),
    note: z.string().trim().max(2000, "บันทึกยาวเกิน 2000 ตัวอักษร").nullish(),
    /// null = ไม่กำหนดวันส่ง
    dueDate: isoDateTime.nullish(),
    priority: priorityEnum.default("medium"),
})
export type CreateTodoInput = z.infer<typeof createTodoSchema>

/// แก้ไขงานส่วนตัว — `isDone` ใช้ติ๊กเสร็จ/ยกเลิกติ๊ก (F3.4)
export const updateTodoSchema = z
    .object({
        title: z.string().trim().min(2, "กรุณากรอกหัวข้องาน").max(200).optional(),
        note: z.string().trim().max(2000).nullish(),
        dueDate: isoDateTime.nullish(),
        priority: priorityEnum.optional(),
        isDone: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>

export const listTodosQuerySchema = z.object({
    /// pending = ยังไม่เสร็จ · done = เสร็จแล้ว · all = ทั้งหมด
    state: z.enum(["pending", "done", "all"]).default("pending"),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>

// ── Time Log (F3.5) ──────────────────────────────────────────────────

/// ประเภทงานที่ผูกกับบันทึกเวลา — ตรงกับคอลัมน์ `WorkLog.refType`
export const WORKLOG_REF_TYPES = ["ticket", "task", "todo", "other"] as const
export type WorkLogRefType = (typeof WORKLOG_REF_TYPES)[number]

export const WORKLOG_REF_LABEL: Record<WorkLogRefType, string> = {
    ticket: "Ticket",
    task: "Task โครงการ",
    todo: "งานส่วนตัว",
    other: "งานอื่นๆ",
}

/// ชั่วโมงทำงาน — ทศนิยม 2 ตำแหน่งตาม Decimal(5,2) และไม่เกิน 24 ชม. ต่อรายการ
const hours = z.coerce
    .number({ message: "กรุณากรอกจำนวนชั่วโมงเป็นตัวเลข" })
    .gt(0, "จำนวนชั่วโมงต้องมากกว่า 0")
    .max(24, "หนึ่งรายการบันทึกได้ไม่เกิน 24 ชั่วโมง")
    .refine((v) => Number.isInteger(Math.round(v * 100)), "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง")

const workLogFields = z.object({
    workDate: isoDate,
    hours,
    description: z
        .string()
        .trim()
        .min(3, "กรุณาอธิบายสิ่งที่ทำอย่างน้อย 3 ตัวอักษร")
        .max(2000, "รายละเอียดยาวเกิน 2000 ตัวอักษร"),
    refType: z.enum(WORKLOG_REF_TYPES, { message: "ประเภทงานไม่ถูกต้อง" }),
    ticketId: z.string().min(1).nullish(),
    taskId: z.string().min(1).nullish(),
    todoId: z.string().min(1).nullish(),
})

/// refType ต้องมากับ id ของงานนั้น — กันข้อมูลกำพร้าที่รายงานภาระงานจะอ่านไม่ออก
function refMatchesId(v: {
    refType?: string
    ticketId?: string | null
    taskId?: string | null
    todoId?: string | null
}): boolean {
    if (v.refType === "ticket") return !!v.ticketId
    if (v.refType === "task") return !!v.taskId
    if (v.refType === "todo") return !!v.todoId
    return true
}

const REF_ISSUE = { path: ["refType"], message: "กรุณาเลือกงานที่ต้องการผูกกับบันทึกเวลานี้" }

export const createWorkLogSchema = workLogFields.refine(refMatchesId, REF_ISSUE)
export type CreateWorkLogInput = z.infer<typeof createWorkLogSchema>

export const updateWorkLogSchema = workLogFields
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
    .refine((v) => v.refType === undefined || refMatchesId(v), REF_ISSUE)
export type UpdateWorkLogInput = z.infer<typeof updateWorkLogSchema>

export const listWorkLogsQuerySchema = z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    refType: z.enum(WORKLOG_REF_TYPES).optional(),
    /// ดูของคนอื่น — หัวหน้าขึ้นไปเท่านั้น (F3.8) · ไม่ใส่ = ของตัวเอง
    userId: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListWorkLogsQuery = z.infer<typeof listWorkLogsQuerySchema>

// ── สรุปชั่วโมงทำงาน (F3.7, F3.8) ────────────────────────────────────

export const workLogSummaryQuerySchema = z.object({
    /// วันอ้างอิงของช่วงที่ต้องการสรุป (ค่าเริ่มต้น = วันนี้ตามเวลาไทย)
    date: isoDate.optional(),
    /// day = วันเดียว · week = จันทร์–อาทิตย์ · month = ทั้งเดือน
    period: z.enum(["day", "week", "month"]).default("week"),
    /// team = สรุปรายคนทั้งทีม (หัวหน้าขึ้นไป — F3.8) · own = ของตัวเอง (F3.7)
    scope: z.enum(["own", "team"]).default("own"),
})
export type WorkLogSummaryQuery = z.infer<typeof workLogSummaryQuerySchema>

// ── My Work (F3.1, F3.2) ─────────────────────────────────────────────

export const myWorkQuerySchema = z.object({
    /// all = รวมทุกประเภทเรียงตามกำหนดส่ง (F3.2)
    kind: z.enum(["all", "ticket", "task", "todo"]).default("all"),
    /// open = งานที่ยังไม่จบ · done = งานที่จบแล้ว · overdue = เลยกำหนด · today = ครบกำหนดวันนี้
    state: z.enum(["open", "done", "overdue", "today"]).default("open"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
})
export type MyWorkQuery = z.infer<typeof myWorkQuerySchema>

// ── ตั้งค่าระบบที่หน้าจอแก้ได้ (F3.6) ────────────────────────────────

/// คีย์ของ `AppSetting` ที่ยอมให้แก้ผ่าน API — จำกัดไว้เพื่อไม่ให้เขียนคีย์อื่นทับ
export const EDITABLE_BOOLEAN_SETTINGS = [
    "ticket.require_worklog_on_resolve",
    "ticket.auto_assign",
] as const
export type EditableBooleanSetting = (typeof EDITABLE_BOOLEAN_SETTINGS)[number]

export const updateSettingsSchema = z
    .object({
        settings: z
            .array(
                z.object({
                    key: z.enum(EDITABLE_BOOLEAN_SETTINGS, {
                        message: "ไม่อนุญาตให้แก้ไขค่าตั้งค่านี้",
                    }),
                    value: z.boolean({ message: "ค่าต้องเป็น true หรือ false" }),
                })
            )
            .min(1, "ไม่มีข้อมูลที่ต้องการบันทึก")
            .max(EDITABLE_BOOLEAN_SETTINGS.length),
    })
    .refine((v) => new Set(v.settings.map((s) => s.key)).size === v.settings.length, {
        path: ["settings"],
        message: "มีคีย์ซ้ำกันในรายการ",
    })
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

export { priorityEnum, isoDate }
