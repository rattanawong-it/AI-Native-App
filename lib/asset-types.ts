// lib/asset-types.ts
// ชนิดข้อมูลฝั่ง client ของทะเบียนครุภัณฑ์ — ให้หน้าจอกับ API พูดภาษาเดียวกัน
// อ้างอิง docs/spec.md §5.6 และ §8 ⑦A
//
// แยกจาก `lib/asset-service.ts` เพราะไฟล์นั้น import prisma — client component นำเข้าไม่ได้

import type { AssetHistoryAction, AssetStatus, AssetType } from "@/lib/asset-workflow"

export interface AssetPerson {
    id: string
    name: string
    email?: string
}

export interface AssetDepartmentRef {
    id: string
    name: string
    code: string
}

export interface AssetRow {
    id: string
    assetCode: string
    name: string
    type: string
    brand: string | null
    model: string | null
    serialNumber: string | null
    status: string
    location: string | null
    /// ISO string — วันที่ทั้งหมดถูกแปลงเป็นข้อความก่อนส่งออกจาก API
    purchaseDate: string | null
    price: number | null
    warrantyEndDate: string | null
    createdAt: string
    updatedAt: string
    custodian: AssetPerson | null
    department: AssetDepartmentRef | null
    /// ป้ายไทยที่ API แปลงมาให้แล้ว — หน้าจอไม่ต้องแมปเอง
    statusLabel: string
    typeLabel: string
}

export interface AssetDetail extends AssetRow {
    note: string | null
    custodianId: string | null
    departmentId: string | null
}

export interface AssetListResponse {
    assets: AssetRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface AssetDetailResponse {
    asset: AssetDetail
}

/// หนึ่งแถวในสมุดประวัติ พร้อมชื่อคนที่ API เติมมาให้แล้ว (F7.4)
export interface AssetHistoryEntry {
    id: string
    assetId: string
    action: AssetHistoryAction | string
    actionLabel: string
    note: string | null
    createdAt: string
    actorName: string | null
    fromUserName: string | null
    toUserName: string | null
}

export interface AssetHistoryResponse {
    histories: AssetHistoryEntry[]
}

export interface AssetQrResponse {
    dataUrl: string
    target: string
    assetCode: string
    name: string
}

/// ผลการนำเข้าไฟล์ CSV (F7.7)
export interface AssetImportResponse {
    dryRun: boolean
    total: number
    created: number
    updated: number
    failed: number
    errors: { line: number; message: string }[]
}

/// ผลการกวาดแจ้งเตือนครุภัณฑ์ใกล้หมดประกัน (F7.6)
export interface WarrantySweepResponse {
    days: number
    matched: number
    notified: number
    skippedNoCustodian: string[]
}

export interface WarrantyListResponse {
    days: number
    total: number
    assets: AssetRow[]
}

/// ตัวเลือกเรียงลำดับในหน้ารายการ (ตรงกับ listAssetQuerySchema)
export const ASSET_SORT_OPTIONS = [
    { key: "latest", label: "เพิ่มล่าสุด" },
    { key: "code", label: "ตามรหัสครุภัณฑ์" },
    { key: "name", label: "ตามชื่อ" },
    { key: "warranty", label: "ประกันหมดก่อน" },
] as const

/// ฟอร์มเพิ่ม/แก้ไขครุภัณฑ์ — เก็บทุกช่องเป็น string เพราะ input ของ HTML คืน string เสมอ
export interface AssetFormValues {
    assetCode: string
    name: string
    type: AssetType
    brand: string
    model: string
    serialNumber: string
    purchaseDate: string
    price: string
    warrantyEndDate: string
    location: string
    status: AssetStatus
    custodianId: string
    departmentId: string
    note: string
}

export const EMPTY_ASSET_FORM: AssetFormValues = {
    assetCode: "",
    name: "",
    type: "computer",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    price: "",
    warrantyEndDate: "",
    location: "",
    status: "in_stock",
    custodianId: "",
    departmentId: "",
    note: "",
}

/// แปลงฟอร์มเป็น payload ของ API — ช่องว่างกลายเป็น `null` ไม่ใช่สตริงว่าง
export function assetFormToPayload(form: AssetFormValues): Record<string, unknown> {
    const text = (value: string) => (value.trim() === "" ? null : value.trim())

    return {
        assetCode: text(form.assetCode),
        name: form.name.trim(),
        type: form.type,
        brand: text(form.brand),
        model: text(form.model),
        serialNumber: text(form.serialNumber),
        purchaseDate: text(form.purchaseDate),
        price: text(form.price),
        warrantyEndDate: text(form.warrantyEndDate),
        location: text(form.location),
        status: form.status,
        custodianId: text(form.custodianId),
        departmentId: text(form.departmentId),
        note: text(form.note),
    }
}

/// เติมฟอร์มจากข้อมูลที่โหลดมา — ตัด ISO string ให้เหลือ "YYYY-MM-DD" ตามที่ <input type="date"> ต้องการ
export function assetToForm(asset: AssetDetail): AssetFormValues {
    return {
        assetCode: asset.assetCode,
        name: asset.name,
        type: asset.type as AssetType,
        brand: asset.brand ?? "",
        model: asset.model ?? "",
        serialNumber: asset.serialNumber ?? "",
        purchaseDate: asset.purchaseDate?.slice(0, 10) ?? "",
        price: asset.price === null ? "" : String(asset.price),
        warrantyEndDate: asset.warrantyEndDate?.slice(0, 10) ?? "",
        location: asset.location ?? "",
        status: asset.status as AssetStatus,
        custodianId: asset.custodianId ?? "",
        departmentId: asset.departmentId ?? "",
        note: asset.note ?? "",
    }
}
