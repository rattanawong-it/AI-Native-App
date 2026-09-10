// lib/department-schema.ts
// Schema ตรวจ payload ของ api/departments (NFR2) — ใช้ zod v4 ข้อความ error เป็นภาษาไทย
//
// `level` ไม่ให้ client ส่งมา — คำนวณจากหน่วยงานแม่ฝั่ง server เพื่อไม่ให้ลำดับชั้นเพี้ยน

import { z } from "zod"

/// ลำดับชั้นลึกสุดที่ยอมให้: สำนัก/คณะ (1) › ฝ่าย (2) › งาน (3)
export const MAX_DEPARTMENT_LEVEL = 3

export const createDepartmentSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "กรุณากรอกชื่อหน่วยงานอย่างน้อย 2 ตัวอักษร")
        .max(200, "ชื่อหน่วยงานยาวเกิน 200 ตัวอักษร"),
    code: z
        .string()
        .trim()
        .min(2, "กรุณากรอกรหัสหน่วยงาน")
        .max(20, "รหัสหน่วยงานยาวเกิน 20 ตัวอักษร")
        .regex(/^[A-Za-z0-9-]+$/, "รหัสหน่วยงานใช้ได้เฉพาะ A-Z, 0-9 และ -"),
    parentId: z.string().min(1).nullish(),
    active: z.boolean().default(true),
})

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>

export const updateDepartmentSchema = createDepartmentSchema
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการแก้ไข" })

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>

/// query ของ GET /api/departments — ทุกตัวเป็น optional เพื่อคงพฤติกรรมเดิม
/// (เรียกเปล่าๆ = คืนหน่วยงานที่เปิดใช้งานทั้งหมด สำหรับเติม dropdown)
export const listDepartmentQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    /// "1" = รวมหน่วยงานที่ปิดใช้งานด้วย (หน้าจัดการหน่วยงานใช้)
    all: z.literal("1").optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export type ListDepartmentQuery = z.infer<typeof listDepartmentQuerySchema>
