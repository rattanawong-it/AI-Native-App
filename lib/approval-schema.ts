// lib/approval-schema.ts
// Schema ตรวจ payload ทุกเส้นใน api/approvals (NFR2)
// อ้างอิง docs/spec.md §8 ⑦B (F7.8–F7.12, F7.14)

import { z } from "zod"
import { APPROVAL_STATUSES, APPROVAL_TYPES } from "@/lib/approval-workflow"

const statusEnum = z.enum(APPROVAL_STATUSES, { message: "สถานะคำขอไม่ถูกต้อง" })
const typeEnum = z.enum(APPROVAL_TYPES, { message: "ประเภทคำขอไม่ถูกต้อง" })

/// จำนวนเงิน — เก็บลง Decimal(12,2) จึงจำกัดไว้ที่หลักพันล้าน
const amountSchema = z.coerce
    .number({ message: "จำนวนเงินต้องเป็นตัวเลข" })
    .min(0, "จำนวนเงินติดลบไม่ได้")
    .max(9_999_999_999, "จำนวนเงินเกินขอบเขตที่เก็บได้")
    .nullish()

/// ผู้อนุมัติตามลำดับขั้น (F7.10) — ลำดับใน array คือ `stepOrder` 1, 2, 3 …
/// ห้ามใส่คนเดิมซ้ำ เพราะจะกลายเป็นต้องกดอนุมัติสองรอบโดยไม่มีความหมาย
const approverIdsSchema = z
    .array(z.string().min(1, "รหัสผู้อนุมัติไม่ถูกต้อง"))
    .min(1, "กรุณาระบุผู้อนุมัติอย่างน้อย 1 คน")
    .max(5, "กำหนดผู้อนุมัติได้ไม่เกิน 5 ขั้น")
    .refine((ids) => new Set(ids).size === ids.length, {
        message: "มีผู้อนุมัติซ้ำกันในลำดับขั้น",
    })

// ── คำขออนุมัติ (F7.8, F7.9) ──────────────────────────────────────────

export const createApprovalSchema = z.object({
    type: typeEnum,
    title: z
        .string()
        .trim()
        .min(5, "กรุณากรอกเรื่องอย่างน้อย 5 ตัวอักษร")
        .max(200, "เรื่องยาวเกิน 200 ตัวอักษร"),
    description: z
        .string()
        .trim()
        .max(20000, "รายละเอียดยาวเกินกำหนด")
        .transform((v) => (v === "" ? null : v))
        .nullish(),
    amount: amountSchema,
    approverIds: approverIdsSchema,
    /// true = ยื่นเข้าสู่การอนุมัติทันทีหลังสร้าง · false = เก็บเป็นฉบับร่างก่อน
    submit: z.boolean().default(false),
})

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>

/// แก้ไขคำขอ — ทำได้เฉพาะตอนที่ยังไม่เข้าสู่การอนุมัติ (ตรวจซ้ำที่ route ด้วย `isEditable`)
export const updateApprovalSchema = z
    .object({
        type: typeEnum.optional(),
        title: z.string().trim().min(5).max(200).optional(),
        description: z
            .string()
            .trim()
            .max(20000)
            .transform((v) => (v === "" ? null : v))
            .nullish(),
        amount: amountSchema,
        /// ส่งมาเมื่อต้องการเปลี่ยนลำดับผู้อนุมัติทั้งชุด (ของเดิมจะถูกแทนที่)
        approverIds: approverIdsSchema.optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })

export type UpdateApprovalInput = z.infer<typeof updateApprovalSchema>

/// ยกเลิกคำขอของตัวเอง (F7.11)
export const cancelApprovalSchema = z.object({
    reason: z.string().trim().max(500, "เหตุผลยาวเกิน 500 ตัวอักษร").optional(),
})

export type CancelApprovalInput = z.infer<typeof cancelApprovalSchema>

// ── การตัดสินใจของผู้อนุมัติ (F7.12) ──────────────────────────────────

export const decideApprovalSchema = z
    .object({
        approved: z.boolean({ message: "กรุณาระบุผลการพิจารณา" }),
        comment: z.string().trim().max(1000, "ความเห็นยาวเกิน 1000 ตัวอักษร").optional(),
    })
    .refine((v) => v.approved || Boolean(v.comment?.length), {
        message: "กรุณาระบุเหตุผลเมื่อไม่อนุมัติ",
        path: ["comment"],
    })

export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>

// ── รายการคำขอ (F7.8, F7.12) ──────────────────────────────────────────

export const listApprovalQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    status: statusEnum.optional(),
    type: typeEnum.optional(),
    requesterId: z.string().min(1).optional(),
    /// `mine` = คำขอที่ฉันยื่น · `to-approve` = ใบที่รอฉันตัดสินใจอยู่ตอนนี้ (F7.12)
    scope: z.enum(["all", "mine", "to-approve"]).default("all"),
    sort: z.enum(["latest", "amount", "status"]).default("latest"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListApprovalQuery = z.infer<typeof listApprovalQuerySchema>

export { statusEnum as approvalStatusEnum, typeEnum as approvalTypeEnum }
