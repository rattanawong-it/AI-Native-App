// lib/asset-schema.ts
// Schema ตรวจ payload ทุกเส้นใน api/assets (NFR2) — ข้อความ error เป็นภาษาไทยเพื่อส่งกลับตรงๆ
// อ้างอิง docs/spec.md §8 ⑦A (F7.1–F7.7)

import { z } from "zod"
import { ASSET_STATUSES, MANUAL_HISTORY_ACTIONS, ASSET_TYPES } from "@/lib/asset-workflow"

const statusEnum = z.enum(ASSET_STATUSES, { message: "สถานะครุภัณฑ์ไม่ถูกต้อง" })
/// รับเฉพาะการกระทำที่เลือกเองได้ — `register` เป็นของระบบตอนขึ้นทะเบียนเท่านั้น
const actionEnum = z.enum(MANUAL_HISTORY_ACTIONS, { message: "ชนิดการเคลื่อนไหวไม่ถูกต้อง" })
const typeEnum = z.enum(ASSET_TYPES, { message: "ประเภทครุภัณฑ์ไม่ถูกต้อง" })

/// ราคา — รับได้ทั้งตัวเลขและสตริงจากฟอร์ม เก็บลง Decimal(12,2)
const priceSchema = z.coerce
    .number({ message: "ราคาต้องเป็นตัวเลข" })
    .min(0, "ราคาติดลบไม่ได้")
    .max(9_999_999_999, "ราคาเกินขอบเขตที่เก็บได้")
    .nullish()

/// วันที่ — รับ ISO string จากฟอร์ม (`<input type="date">` ส่ง "2026-09-02")
const dateSchema = z.coerce.date({ message: "รูปแบบวันที่ไม่ถูกต้อง" }).nullish()

/// ช่องข้อความสั้นที่ปล่อยว่างได้ — ว่างเปล่าถือเป็น null ไม่ใช่สตริงว่าง
const optionalText = (max: number, label: string) =>
    z
        .string()
        .trim()
        .max(max, `${label}ยาวเกิน ${max} ตัวอักษร`)
        .transform((v) => (v === "" ? null : v))
        .nullish()

// ── ครุภัณฑ์ (F7.1, F7.2) ─────────────────────────────────────────────

export const createAssetSchema = z.object({
    /// เว้นว่างได้ — ระบบจะออกรหัสรันนิ่งให้เอง (AS-256909-0001)
    assetCode: optionalText(60, "รหัสครุภัณฑ์"),
    name: z
        .string()
        .trim()
        .min(2, "กรุณากรอกชื่อครุภัณฑ์อย่างน้อย 2 ตัวอักษร")
        .max(200, "ชื่อครุภัณฑ์ยาวเกิน 200 ตัวอักษร"),
    type: typeEnum,
    brand: optionalText(100, "ยี่ห้อ"),
    model: optionalText(100, "รุ่น"),
    serialNumber: optionalText(120, "หมายเลขเครื่อง"),
    purchaseDate: dateSchema,
    price: priceSchema,
    warrantyEndDate: dateSchema,
    location: optionalText(200, "สถานที่"),
    status: statusEnum.default("in_stock"),
    custodianId: z.string().min(1).nullish(),
    departmentId: z.string().min(1).nullish(),
    note: optionalText(2000, "หมายเหตุ"),
})

export type CreateAssetInput = z.infer<typeof createAssetSchema>

/// แก้ไขครุภัณฑ์ — ส่งเฉพาะฟิลด์ที่เปลี่ยน
/// การเปลี่ยน `status` / `custodianId` ผ่านเส้นนี้จะบันทึกประวัติให้อัตโนมัติ (F7.4)
export const updateAssetSchema = z
    .object({
        assetCode: z.string().trim().min(1).max(60).optional(),
        name: z.string().trim().min(2).max(200).optional(),
        type: typeEnum.optional(),
        brand: optionalText(100, "ยี่ห้อ"),
        model: optionalText(100, "รุ่น"),
        serialNumber: optionalText(120, "หมายเลขเครื่อง"),
        purchaseDate: dateSchema,
        price: priceSchema,
        warrantyEndDate: dateSchema,
        location: optionalText(200, "สถานที่"),
        status: statusEnum.optional(),
        custodianId: z.string().min(1).nullish(),
        departmentId: z.string().min(1).nullish(),
        note: optionalText(2000, "หมายเหตุ"),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })

export type UpdateAssetInput = z.infer<typeof updateAssetSchema>

/// query string ของหน้ารายการครุภัณฑ์ (F7.1) — ใช้ร่วมกับเส้น export CSV ด้วย (F7.7)
export const listAssetQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    status: statusEnum.optional(),
    type: typeEnum.optional(),
    custodianId: z.string().min(1).optional(),
    departmentId: z.string().min(1).optional(),
    /// เหลือประกันไม่เกินกี่วัน — ใช้ทำรายการ "ใกล้หมดประกัน" (F7.6)
    warrantyWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
    sort: z.enum(["latest", "code", "name", "warranty"]).default("latest"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListAssetQuery = z.infer<typeof listAssetQuerySchema>

// ── ประวัติการเคลื่อนไหว (F7.4) ───────────────────────────────────────

/// บันทึกการโอน / ซ่อม / คืน / จำหน่าย — สถานะครุภัณฑ์จะถูกปรับตามชนิดการกระทำ
export const createAssetHistorySchema = z.object({
    action: actionEnum,
    /// ผู้รับปลายทาง — จำเป็นสำหรับ `assign` / `transfer`
    toUserId: z.string().min(1).nullish(),
    note: optionalText(1000, "หมายเหตุ"),
})

export type CreateAssetHistoryInput = z.infer<typeof createAssetHistorySchema>

// ── นำเข้า CSV (F7.7) ─────────────────────────────────────────────────

/// หนึ่งแถวจากไฟล์ CSV — หัวคอลัมน์ภาษาไทยจะถูกแมปเป็นชื่อฟิลด์ก่อนตรวจด้วย schema นี้
export const importAssetRowSchema = z.object({
    assetCode: z.string().trim().max(60).optional(),
    name: z.string().trim().min(2, "ชื่อครุภัณฑ์สั้นเกินไป").max(200),
    type: z.string().trim().max(40).optional(),
    brand: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    serialNumber: z.string().trim().max(120).optional(),
    purchaseDate: z.string().trim().max(40).optional(),
    price: z.string().trim().max(40).optional(),
    warrantyEndDate: z.string().trim().max(40).optional(),
    location: z.string().trim().max(200).optional(),
    status: z.string().trim().max(40).optional(),
    note: z.string().trim().max(2000).optional(),
})

export type ImportAssetRow = z.infer<typeof importAssetRowSchema>

export const importAssetSchema = z.object({
    /// เนื้อไฟล์ CSV ทั้งก้อน (ส่งเป็นข้อความ ไม่ผ่าน multipart เพราะยังไม่มีที่เก็บไฟล์ — ดู F1.7)
    csv: z.string().min(1, "ไม่พบเนื้อหาไฟล์ CSV").max(2_000_000, "ไฟล์ใหญ่เกิน 2 MB"),
    /// true = ตรวจอย่างเดียว ไม่บันทึกจริง (ให้ผู้ใช้ดูผลก่อน)
    dryRun: z.boolean().default(false),
})

export type ImportAssetInput = z.infer<typeof importAssetSchema>

export { statusEnum as assetStatusEnum, typeEnum as assetTypeEnum }
