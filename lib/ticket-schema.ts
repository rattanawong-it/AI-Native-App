// lib/ticket-schema.ts
// Schema ตรวจความถูกต้องของ payload ทุกเส้นใน api/tickets และ api/categories (NFR2)
// ใช้ zod v4 — ข้อความ error เป็นภาษาไทยเพื่อส่งกลับให้ผู้ใช้ได้ตรงๆ

import { z } from "zod"
import { IMPACT_LEVELS, URGENCY_LEVELS, PRIORITY_LEVELS } from "@/lib/priority"
import { TICKET_STATUSES, TICKET_CHANNELS } from "@/lib/ticket-workflow"
import { BREACH_FILTERS } from "@/lib/sla-service"

const impactEnum = z.enum(IMPACT_LEVELS, { message: "ระดับผลกระทบไม่ถูกต้อง" })
const urgencyEnum = z.enum(URGENCY_LEVELS, { message: "ระดับความเร่งด่วนไม่ถูกต้อง" })
const priorityEnum = z.enum(PRIORITY_LEVELS, { message: "ระดับความสำคัญไม่ถูกต้อง" })
const statusEnum = z.enum(TICKET_STATUSES, { message: "สถานะไม่ถูกต้อง" })
const channelEnum = z.enum(TICKET_CHANNELS, { message: "ช่องทางการแจ้งไม่ถูกต้อง" })

/// สร้าง Ticket ใหม่ (F1.2) — `requesterId` ใส่ได้เฉพาะเจ้าหน้าที่ที่แจ้งแทนผู้อื่น (F1.10)
export const createTicketSchema = z.object({
    title: z
        .string()
        .trim()
        .min(5, "กรุณากรอกหัวข้ออย่างน้อย 5 ตัวอักษร")
        .max(200, "หัวข้อยาวเกิน 200 ตัวอักษร"),
    description: z
        .string()
        .trim()
        .min(10, "กรุณาอธิบายปัญหาอย่างน้อย 10 ตัวอักษร")
        .max(10000, "รายละเอียดยาวเกินกำหนด"),
    categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่บริการ"),
    impact: impactEnum,
    urgency: urgencyEnum,
    channel: channelEnum.default("web"),
    departmentId: z.string().min(1).nullish(),
    /// แจ้งแทนผู้อื่น — เจ้าหน้าที่เท่านั้น (F1.10)
    requesterId: z.string().min(1).nullish(),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

/// แก้ไขรายละเอียด Ticket — ปรับ Impact/Urgency ได้ (F2.4) ต้องระบุเหตุผล
export const updateTicketSchema = z
    .object({
        title: z.string().trim().min(5).max(200).optional(),
        description: z.string().trim().min(10).max(10000).optional(),
        categoryId: z.string().min(1).optional(),
        impact: impactEnum.optional(),
        urgency: urgencyEnum.optional(),
        departmentId: z.string().min(1).nullish(),
        /// เหตุผลที่ปรับ — บันทึกลง TicketActivity (F2.4)
        reason: z.string().trim().max(500).optional(),
    })
    .refine((v) => Object.keys(v).some((k) => k !== "reason"), {
        message: "ไม่มีข้อมูลที่ต้องการแก้ไข",
    })

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>

/// เปลี่ยนสถานะ (F2.6) — เข้าสถานะ resolved ต้องมี resolutionNote
export const changeStatusSchema = z
    .object({
        status: statusEnum,
        note: z.string().trim().max(500).optional(),
        /// สรุปการแก้ไข — บังคับเมื่อ status = resolved
        resolutionNote: z.string().trim().max(5000).optional(),
        /// ชั่วโมงที่ใช้ทำงาน — บันทึกเป็น WorkLog ถ้ากรอกมา (F2.6 / เชื่อมกับ F3.5)
        workHours: z.coerce.number().min(0).max(24).optional(),
    })
    .refine((v) => v.status !== "resolved" || (v.resolutionNote?.length ?? 0) >= 5, {
        path: ["resolutionNote"],
        message: "กรุณาสรุปวิธีการแก้ไขก่อนปิดงาน (อย่างน้อย 5 ตัวอักษร)",
    })

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>

/// มอบหมาย / โยกย้ายงาน (F2.7, F2.8) — assigneeId = null คือถอนการมอบหมาย
export const assignTicketSchema = z.object({
    assigneeId: z.string().min(1).nullable(),
    teamId: z.string().min(1).nullish(),
    note: z.string().trim().max(500).optional(),
})

export type AssignTicketInput = z.infer<typeof assignTicketSchema>

/// เพิ่มความคิดเห็น (F1.6) — isInternal = บันทึกภายใน ผู้แจ้งไม่เห็น
export const createCommentSchema = z.object({
    body: z
        .string()
        .trim()
        .min(1, "กรุณาพิมพ์ข้อความ")
        .max(5000, "ข้อความยาวเกิน 5000 ตัวอักษร"),
    isInternal: z.boolean().default(false),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>

// ── Query string ของหน้ารายการ (F1.3, F1.11) ────────────────────────

/// รับค่าที่คั่นด้วย comma เช่น `status=new,assigned` ให้เป็น array
const csv = <T extends readonly [string, ...string[]]>(values: T) =>
    z
        .string()
        .optional()
        .transform((raw) =>
            (raw ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter((s): s is T[number] => (values as readonly string[]).includes(s))
        )

export const listTicketsQuerySchema = z.object({
    /// ค้นหาแบบ full-text ใน title + description + ticketNo (F1.11)
    q: z.string().trim().max(200).optional(),
    status: csv(TICKET_STATUSES),
    priority: csv(PRIORITY_LEVELS),
    channel: csv(TICKET_CHANNELS),
    categoryId: z.string().min(1).optional(),
    assigneeId: z.string().min(1).optional(),
    requesterId: z.string().min(1).optional(),
    teamId: z.string().min(1).optional(),
    /// ช่วงวันที่สร้าง (ISO date) — from/to แบบรวมปลายทาง
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
    /// เฉพาะใบที่เกินกำหนด — response | resolution | any (F4.11)
    breached: z.enum(BREACH_FILTERS).optional(),
    /// เรียงลำดับ — queue = Priority DESC → resolutionDueAt ASC (F2.5)
    sort: z.enum(["queue", "newest", "oldest", "due"]).default("queue"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>

/// อ่าน query string จาก URL ให้เป็น object ก่อนส่งเข้า zod
export function searchParamsToObject(url: URL): Record<string, string> {
    const out: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
        if (value !== "") out[key] = value
    })
    return out
}

// ── Service Catalog (F1.8) ───────────────────────────────────────────

export const createCategorySchema = z.object({
    name: z.string().trim().min(2, "กรุณากรอกชื่อหมวดหมู่").max(120),
    slug: z
        .string()
        .trim()
        .min(2, "กรุณากรอก slug")
        .max(120)
        .regex(/^[a-z0-9-]+$/, "slug ใช้ได้เฉพาะ a-z, 0-9 และ -"),
    parentId: z.string().min(1).nullish(),
    description: z.string().trim().max(500).nullish(),
    defaultTeamId: z.string().min(1).nullish(),
    defaultAssigneeId: z.string().min(1).nullish(),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = createCategorySchema.partial().refine(
    (v) => Object.keys(v).length > 0,
    { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" }
)

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

/// แปลง issue ของ zod เป็นข้อความไทยบรรทัดเดียว สำหรับ badRequest()
export function firstIssueMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
}

export { priorityEnum, statusEnum, channelEnum, impactEnum, urgencyEnum }
