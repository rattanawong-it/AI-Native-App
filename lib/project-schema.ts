// lib/project-schema.ts
// Schema ตรวจความถูกต้องของ payload ในกลุ่ม SDLC (NFR2)
//   api/projects · api/sprints · api/tasks · api/teams · api/tickets/[id]/convert
// ใช้ zod v4 — ข้อความ error เป็นภาษาไทยเพื่อส่งกลับให้ผู้ใช้ได้ตรงๆ
// อ้างอิง docs/spec.md §8 ⑤ (F5.1–F5.13) และ §5.4

import { z } from "zod"
import { PRIORITY_LEVELS } from "@/lib/priority"
import {
    BOARD_STATUSES,
    PROJECT_STATUSES,
    SPRINT_STATUSES,
    TEAM_ROLES,
} from "@/lib/task-board"

const priorityEnum = z.enum(PRIORITY_LEVELS, { message: "ระดับความสำคัญไม่ถูกต้อง" })
const boardStatusEnum = z.enum(BOARD_STATUSES, { message: "คอลัมน์บนกระดานไม่ถูกต้อง" })
const projectStatusEnum = z.enum(PROJECT_STATUSES, { message: "สถานะโครงการไม่ถูกต้อง" })
const sprintStatusEnum = z.enum(SPRINT_STATUSES, { message: "สถานะ Sprint ไม่ถูกต้อง" })

/// วันที่ — รับได้ทั้ง "2026-09-01" และ ISO เต็ม · แบบสั้นตีความเป็นสิ้นวันตามเวลาไทย
/// เพื่อให้ "กำหนดส่งวันที่ 1" หมายถึงทั้งวันที่ 1 ไม่ใช่เที่ยงคืนที่ 1 ซึ่งเลยกำหนดทันที
const isoDateTime = z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v.length === 10 ? `${v}T23:59:59.999+07:00` : v)), {
        message: "รูปแบบวันที่ไม่ถูกต้อง",
    })
    .transform((v) => new Date(v.length === 10 ? `${v}T23:59:59.999+07:00` : v))

/// วันเริ่ม — แบบสั้นตีความเป็นต้นวันตามเวลาไทย
const isoStartDate = z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v.length === 10 ? `${v}T00:00:00.000+07:00` : v)), {
        message: "รูปแบบวันที่ไม่ถูกต้อง",
    })
    .transform((v) => new Date(v.length === 10 ? `${v}T00:00:00.000+07:00` : v))

// ── โครงการ (F5.1, F5.2) ─────────────────────────────────────────────

/// รหัสโครงการ — ตัวพิมพ์ใหญ่/ตัวเลข/ขีด เท่านั้น เพราะใช้เป็นตัวนำหน้าที่คนพิมพ์อ้างถึงบ่อย
const projectCode = z
    .string({ message: "กรุณากรอกรหัสโครงการ" })
    .trim()
    .min(2, "รหัสโครงการต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(20, "รหัสโครงการยาวเกิน 20 ตัวอักษร")
    .regex(/^[A-Za-z0-9-]+$/, "รหัสโครงการใช้ได้เฉพาะ A–Z, 0–9 และ -")
    .transform((v) => v.toUpperCase())

export const createProjectSchema = z
    .object({
        code: projectCode,
        name: z
            .string({ message: "กรุณากรอกชื่อโครงการ" })
            .trim()
            .min(3, "กรุณากรอกชื่อโครงการอย่างน้อย 3 ตัวอักษร")
            .max(200, "ชื่อโครงการยาวเกิน 200 ตัวอักษร"),
        description: z.string().trim().max(5000, "รายละเอียดยาวเกิน 5000 ตัวอักษร").nullish(),
        status: projectStatusEnum.default("planning"),
        /// ไม่ระบุ = ผู้สร้างเป็นเจ้าของโครงการ
        ownerId: z.string().min(1).nullish(),
        teamId: z.string().min(1).nullish(),
        startDate: isoStartDate.nullish(),
        endDate: isoDateTime.nullish(),
    })
    .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
        path: ["endDate"],
        message: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มโครงการ",
    })
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z
    .object({
        code: projectCode.optional(),
        name: z.string().trim().min(3, "กรุณากรอกชื่อโครงการ").max(200).optional(),
        description: z.string().trim().max(5000).nullish(),
        status: projectStatusEnum.optional(),
        ownerId: z.string().min(1).optional(),
        teamId: z.string().min(1).nullish(),
        startDate: isoStartDate.nullish(),
        endDate: isoDateTime.nullish(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
    .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
        path: ["endDate"],
        message: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มโครงการ",
    })
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export const listProjectsQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    /// open = โครงการที่ยังต้องติดตาม (ไม่รวมที่จบ/ยกเลิกแล้ว) · all = ทุกสถานะ
    status: z.union([projectStatusEnum, z.literal("all"), z.literal("open")]).default("open"),
    teamId: z.string().min(1).optional(),
    ownerId: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
})
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>

// ── Sprint (F5.3) ────────────────────────────────────────────────────

const sprintFields = z.object({
    name: z
        .string({ message: "กรุณากรอกชื่อ Sprint" })
        .trim()
        .min(2, "กรุณากรอกชื่อ Sprint อย่างน้อย 2 ตัวอักษร")
        .max(120, "ชื่อ Sprint ยาวเกิน 120 ตัวอักษร"),
    goal: z.string().trim().max(1000, "เป้าหมายยาวเกิน 1000 ตัวอักษร").nullish(),
    startDate: isoStartDate,
    endDate: isoDateTime,
    status: sprintStatusEnum.default("planned"),
})

const SPRINT_RANGE_ISSUE = {
    path: ["endDate"],
    message: "วันสิ้นสุด Sprint ต้องไม่มาก่อนวันเริ่ม",
}

export const createSprintSchema = sprintFields.refine(
    (v) => v.startDate <= v.endDate,
    SPRINT_RANGE_ISSUE
)
export type CreateSprintInput = z.infer<typeof createSprintSchema>

export const updateSprintSchema = sprintFields
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
    .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, SPRINT_RANGE_ISSUE)
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>

// ── Task (F5.6) ──────────────────────────────────────────────────────

/// ชั่วโมงที่ประมาณไว้ — ตรงกับ Decimal(6,2) ของ `Task.estimateHours`
const estimateHours = z.coerce
    .number({ message: "กรุณากรอกชั่วโมงที่ประมาณเป็นตัวเลข" })
    .gt(0, "ชั่วโมงที่ประมาณต้องมากกว่า 0")
    .max(9999, "ชั่วโมงที่ประมาณสูงเกินไป")
    .refine((v) => Number.isInteger(Math.round(v * 100)), "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง")

export const createTaskSchema = z.object({
    projectId: z.string({ message: "กรุณาเลือกโครงการ" }).min(1, "กรุณาเลือกโครงการ"),
    sprintId: z.string().min(1).nullish(),
    title: z
        .string({ message: "กรุณากรอกหัวข้องาน" })
        .trim()
        .min(3, "กรุณากรอกหัวข้องานอย่างน้อย 3 ตัวอักษร")
        .max(200, "หัวข้องานยาวเกิน 200 ตัวอักษร"),
    description: z.string().trim().max(10000, "รายละเอียดยาวเกินกำหนด").nullish(),
    boardStatus: boardStatusEnum.default("backlog"),
    priority: priorityEnum.default("medium"),
    assigneeId: z.string().min(1).nullish(),
    estimateHours: estimateHours.nullish(),
    dueDate: isoDateTime.nullish(),
})
export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const updateTaskSchema = z
    .object({
        title: z.string().trim().min(3, "กรุณากรอกหัวข้องาน").max(200).optional(),
        description: z.string().trim().max(10000).nullish(),
        boardStatus: boardStatusEnum.optional(),
        priority: priorityEnum.optional(),
        /// null = ถอนผู้รับผิดชอบออก
        assigneeId: z.string().min(1).nullish(),
        /// null = ย้ายกลับ Backlog ของโครงการ
        sprintId: z.string().min(1).nullish(),
        estimateHours: estimateHours.nullish(),
        dueDate: isoDateTime.nullish(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

/// ลากการ์ดข้ามคอลัมน์ / สลับลำดับ / โยนเข้า Sprint (F5.5, F5.13)
///
/// `beforeTaskId` คือการ์ดที่จะให้ไปแทรก "ก่อนหน้า" — ไม่ระบุ = ต่อท้ายคอลัมน์
export const moveTaskSchema = z.object({
    boardStatus: boardStatusEnum,
    /// undefined = ไม่เปลี่ยน Sprint · null = ย้ายออกจาก Sprint กลับไป Backlog
    sprintId: z.string().min(1).nullish(),
    beforeTaskId: z.string().min(1).nullish(),
})
export type MoveTaskInput = z.infer<typeof moveTaskSchema>

export const listTasksQuerySchema = z.object({
    projectId: z.string().min(1).optional(),
    /// "none" = เฉพาะงานที่ยังไม่เข้า Sprint (Backlog view — F5.13)
    sprintId: z.union([z.string().min(1), z.literal("none")]).optional(),
    boardStatus: boardStatusEnum.optional(),
    priority: priorityEnum.optional(),
    /// "me" = งานของฉัน · "unassigned" = ยังไม่มีผู้รับผิดชอบ
    assigneeId: z.string().min(1).optional(),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>

/// ความเห็นใน Task (F5.7)
export const createTaskCommentSchema = z.object({
    body: z
        .string({ message: "กรุณาพิมพ์ข้อความก่อนส่ง" })
        .trim()
        .min(1, "กรุณาพิมพ์ข้อความก่อนส่ง")
        .max(5000, "ข้อความยาวเกิน 5000 ตัวอักษร"),
})
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>

// ── แปลง Ticket → Task (F5.8) ────────────────────────────────────────

export const convertTicketSchema = z.object({
    projectId: z
        .string({ message: "กรุณาเลือกโครงการปลายทาง" })
        .min(1, "กรุณาเลือกโครงการปลายทาง"),
    sprintId: z.string().min(1).nullish(),
    /// ไม่ระบุ = ใช้หัวข้อของ Ticket
    title: z.string().trim().min(3).max(200).optional(),
    priority: priorityEnum.optional(),
    assigneeId: z.string().min(1).nullish(),
    estimateHours: estimateHours.nullish(),
    dueDate: isoDateTime.nullish(),
})
export type ConvertTicketInput = z.infer<typeof convertTicketSchema>

// ── ทีมงาน (F5.11) ───────────────────────────────────────────────────

export const createTeamSchema = z.object({
    name: z
        .string({ message: "กรุณากรอกชื่อทีม" })
        .trim()
        .min(2, "กรุณากรอกชื่อทีมอย่างน้อย 2 ตัวอักษร")
        .max(120, "ชื่อทีมยาวเกิน 120 ตัวอักษร"),
    description: z.string().trim().max(1000, "รายละเอียดยาวเกิน 1000 ตัวอักษร").nullish(),
    leaderId: z.string().min(1).nullish(),
    active: z.boolean().default(true),
})
export type CreateTeamInput = z.infer<typeof createTeamSchema>

export const updateTeamSchema = z
    .object({
        name: z.string().trim().min(2, "กรุณากรอกชื่อทีม").max(120).optional(),
        description: z.string().trim().max(1000).nullish(),
        leaderId: z.string().min(1).nullish(),
        active: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>

export const addTeamMemberSchema = z.object({
    userId: z
        .string({ message: "กรุณาเลือกผู้ใช้ที่ต้องการเพิ่ม" })
        .min(1, "กรุณาเลือกผู้ใช้ที่ต้องการเพิ่ม"),
    roleInTeam: z.enum(TEAM_ROLES, { message: "บทบาทในทีมไม่ถูกต้อง" }).default("member"),
})
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>

export const listTeamsQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    /// ไม่ระบุ = เฉพาะทีมที่เปิดใช้งาน
    state: z.enum(["active", "inactive", "all"]).default("active"),
})
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>

export { priorityEnum, boardStatusEnum, projectStatusEnum, sprintStatusEnum, isoDateTime }
