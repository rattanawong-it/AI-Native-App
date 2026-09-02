// lib/kb-schema.ts
// Schema ตรวจความถูกต้องของ payload ทุกเส้นใน api/kb (NFR2)
// ใช้ zod v4 — ข้อความ error เป็นภาษาไทยเพื่อส่งกลับให้ผู้ใช้ได้ตรงๆ

import { z } from "zod"
import { KB_STATUSES, KB_VISIBILITIES } from "@/lib/kb-workflow"

const statusEnum = z.enum(KB_STATUSES, { message: "สถานะบทความไม่ถูกต้อง" })
const visibilityEnum = z.enum(KB_VISIBILITIES, { message: "ระดับการมองเห็นไม่ถูกต้อง" })

/// แท็ก — ตัดช่องว่าง ตัดตัวซ้ำ และจำกัดจำนวนเพื่อไม่ให้ filter บวม (F6.3)
const tagsSchema = z
    .array(z.string().trim().min(1).max(40))
    .max(10, "ใส่แท็กได้ไม่เกิน 10 รายการ")
    .transform((list) => Array.from(new Set(list)))

/// สร้างบทความใหม่ (F6.1) — สร้างได้เฉพาะสถานะ draft/pending_review
/// การเผยแพร่ต้องไปผ่าน endpoint publish เพื่อให้ sync RAG ทำงานเสมอ (F6.9)
export const createKbArticleSchema = z.object({
    title: z
        .string()
        .trim()
        .min(5, "กรุณากรอกหัวข้ออย่างน้อย 5 ตัวอักษร")
        .max(200, "หัวข้อยาวเกิน 200 ตัวอักษร"),
    summary: z.string().trim().max(500, "บทสรุปยาวเกิน 500 ตัวอักษร").nullish(),
    content: z
        .string()
        .trim()
        .min(20, "กรุณากรอกเนื้อหาอย่างน้อย 20 ตัวอักษร")
        .max(100000, "เนื้อหายาวเกินกำหนด"),
    categoryId: z.string().min(1).nullish(),
    tags: tagsSchema.optional(),
    visibility: visibilityEnum.default("all"),
    /// Ticket ต้นทางเมื่อกดปุ่ม "บันทึกเป็นองค์ความรู้" (F6.13)
    sourceTicketId: z.string().min(1).nullish(),
})

export type CreateKbArticleInput = z.infer<typeof createKbArticleSchema>

/// แก้ไขบทความ (F6.1) — ส่งเฉพาะฟิลด์ที่เปลี่ยน
export const updateKbArticleSchema = z
    .object({
        title: z.string().trim().min(5).max(200).optional(),
        summary: z.string().trim().max(500).nullish(),
        content: z.string().trim().min(20).max(100000).optional(),
        categoryId: z.string().min(1).nullish(),
        tags: tagsSchema.optional(),
        visibility: visibilityEnum.optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
        message: "ไม่มีข้อมูลที่ต้องการแก้ไข",
    })

export type UpdateKbArticleInput = z.infer<typeof updateKbArticleSchema>

/// เปลี่ยนสถานะบทความ (F6.4, F6.5) — ปลายทาง published จะ sync เข้า RAG (F6.9)
/// ส่วน archived/draft จะลบ vector ออก (F6.10)
export const changeKbStatusSchema = z.object({
    status: statusEnum,
    /// เหตุผลตอนตีกลับให้แก้ — แสดงให้ผู้เขียนเห็น
    note: z.string().trim().max(500).optional(),
})

export type ChangeKbStatusInput = z.infer<typeof changeKbStatusSchema>

/// โหวต "มีประโยชน์ / ไม่มีประโยชน์" (F6.8)
export const kbFeedbackSchema = z.object({
    isHelpful: z.boolean({ message: "กรุณาระบุว่าบทความมีประโยชน์หรือไม่" }),
    comment: z.string().trim().max(1000, "ความเห็นยาวเกิน 1000 ตัวอักษร").optional(),
})

export type KbFeedbackInput = z.infer<typeof kbFeedbackSchema>

/// query string ของหน้ารายการ (F6.3)
export const listKbQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    categoryId: z.string().min(1).optional(),
    tag: z.string().trim().max(40).optional(),
    status: statusEnum.optional(),
    visibility: visibilityEnum.optional(),
    /// true = ดึงเฉพาะบทความที่เผยแพร่แล้ว (หน้าอ่านฝั่งผู้ใช้)
    publishedOnly: z
        .union([z.literal("true"), z.literal("false")])
        .transform((v) => v === "true")
        .optional(),
    sort: z.enum(["latest", "popular", "helpful", "title"]).default("latest"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListKbQuery = z.infer<typeof listKbQuerySchema>

/// ค้นหาบทความที่เกี่ยวข้องกับ Ticket ด้วย vector search (F6.12)
export const suggestKbQuerySchema = z.object({
    ticketId: z.string().min(1).optional(),
    q: z.string().trim().min(3, "กรุณาระบุคำค้นอย่างน้อย 3 ตัวอักษร").max(2000).optional(),
    topK: z.coerce.number().int().min(1).max(10).default(3),
})

export type SuggestKbQuery = z.infer<typeof suggestKbQuerySchema>

export { statusEnum as kbStatusEnum, visibilityEnum as kbVisibilityEnum }
