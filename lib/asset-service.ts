// lib/asset-service.ts
// Helper กลางของทะเบียนครุภัณฑ์ — select shape, ตัวกรอง, รหัสรันนิ่ง, บันทึกประวัติ, CSV
// อ้างอิง docs/spec.md §5.6 (Asset, AssetHistory) และ §8 ⑦A (F7.1–F7.7)

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { periodCode } from "@/lib/running-number"
import {
    ASSET_HISTORY_ACTION_LABEL,
    ASSET_STATUS_LABEL,
    ASSET_TYPE_LABEL,
    type AssetHistoryAction,
    isAssetStatus,
    isAssetType,
} from "@/lib/asset-workflow"
import type { ListAssetQuery } from "@/lib/asset-schema"

/// ส่วนนำหน้ารหัสครุภัณฑ์ที่ระบบออกให้เอง — ปรับได้ผ่าน env เหมือน TICKET_PREFIX (M13)
const ASSET_PREFIX = process.env.ASSET_PREFIX || "AS"

// ── Select shape ─────────────────────────────────────────────────────

const personSelect = { select: { id: true, name: true, email: true } }

export const assetListSelect = {
    id: true,
    assetCode: true,
    name: true,
    type: true,
    brand: true,
    model: true,
    serialNumber: true,
    status: true,
    location: true,
    purchaseDate: true,
    price: true,
    warrantyEndDate: true,
    createdAt: true,
    updatedAt: true,
    custodian: personSelect,
    department: { select: { id: true, name: true, code: true } },
} satisfies Prisma.AssetSelect

export const assetDetailSelect = {
    ...assetListSelect,
    note: true,
    custodianId: true,
    departmentId: true,
} satisfies Prisma.AssetSelect

export const assetHistorySelect = {
    id: true,
    assetId: true,
    action: true,
    fromUserId: true,
    toUserId: true,
    note: true,
    actorId: true,
    createdAt: true,
} satisfies Prisma.AssetHistorySelect

export type AssetListRow = Prisma.AssetGetPayload<{ select: typeof assetListSelect }>
export type AssetDetailRow = Prisma.AssetGetPayload<{ select: typeof assetDetailSelect }>
export type AssetHistoryRow = Prisma.AssetHistoryGetPayload<{
    select: typeof assetHistorySelect
}>

// ── แปลงค่าก่อนส่งออก JSON ──────────────────────────────────────────

/// Decimal ของ Prisma ผ่าน JSON.stringify แล้วได้ object ไม่ใช่ตัวเลข จึงต้องแปลงเองทุกครั้ง
/// null ต้องคงเป็น null — "ไม่ทราบราคา" กับ "ราคา 0 บาท" คนละความหมายกัน
export function decimalOrNull(value: Prisma.Decimal | number | string | null): number | null {
    if (value === null) return null
    const n = typeof value === "number" ? value : Number(value.toString())
    return Number.isFinite(n) ? n : null
}

export function toAssetDto(row: AssetListRow | AssetDetailRow) {
    return {
        ...row,
        price: decimalOrNull(row.price),
        purchaseDate: row.purchaseDate?.toISOString() ?? null,
        warrantyEndDate: row.warrantyEndDate?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        statusLabel: isAssetStatus(row.status) ? ASSET_STATUS_LABEL[row.status] : row.status,
        typeLabel: isAssetType(row.type) ? ASSET_TYPE_LABEL[row.type] : row.type,
    }
}

// ── ตัวกรองและการเรียงลำดับ (F7.1) ────────────────────────────────────

/// วันสุดท้ายที่ยังนับว่า "ใกล้หมดประกัน" — บวกจากวันนี้ตามจำนวนวันที่ขอมา (F7.6)
export function warrantyDeadline(days: number, from: Date = new Date()): Date {
    const deadline = new Date(from)
    deadline.setDate(deadline.getDate() + days)
    return deadline
}

export function buildAssetWhere(query: ListAssetQuery): Prisma.AssetWhereInput {
    const and: Prisma.AssetWhereInput[] = []

    if (query.status) and.push({ status: query.status })
    if (query.type) and.push({ type: query.type })
    if (query.custodianId) and.push({ custodianId: query.custodianId })
    if (query.departmentId) and.push({ departmentId: query.departmentId })

    if (query.warrantyWithinDays !== undefined) {
        // ครุภัณฑ์ที่จำหน่ายแล้วไม่ต้องเตือนประกัน และที่หมดประกันไปแล้วก็ไม่ต้องเตือนซ้ำ
        and.push({
            status: { not: "disposed" },
            warrantyEndDate: {
                gte: new Date(),
                lte: warrantyDeadline(query.warrantyWithinDays),
            },
        })
    }

    if (query.q) {
        and.push({
            OR: [
                { assetCode: { contains: query.q, mode: "insensitive" } },
                { name: { contains: query.q, mode: "insensitive" } },
                { brand: { contains: query.q, mode: "insensitive" } },
                { model: { contains: query.q, mode: "insensitive" } },
                { serialNumber: { contains: query.q, mode: "insensitive" } },
                { location: { contains: query.q, mode: "insensitive" } },
            ],
        })
    }

    if (and.length === 0) return {}
    return and.length === 1 ? and[0] : { AND: and }
}

export function buildAssetOrderBy(
    sort: ListAssetQuery["sort"]
): Prisma.AssetOrderByWithRelationInput[] {
    switch (sort) {
        case "code":
            return [{ assetCode: "asc" }]
        case "name":
            return [{ name: "asc" }]
        case "warranty":
            return [{ warrantyEndDate: { sort: "asc", nulls: "last" } }, { assetCode: "asc" }]
        default:
            return [{ createdAt: "desc" }]
    }
}

// ── รหัสครุภัณฑ์ (F7.2) ───────────────────────────────────────────────

/// ออกรหัสครุภัณฑ์ถัดไปของเดือนนี้ — เช่น "AS-256909-0042"
/// ใช้เมื่อผู้ใช้ไม่ได้กรอกรหัสของทางราชการมาเอง
export async function nextAssetCode(date: Date = new Date()): Promise<string> {
    const period = `${ASSET_PREFIX}-${periodCode(date)}-`
    const latest = await prisma.asset.findFirst({
        where: { assetCode: { startsWith: period } },
        orderBy: { assetCode: "desc" },
        select: { assetCode: true },
    })
    const seq = latest ? Number(latest.assetCode.split("-").pop()) : 0
    const next = (Number.isFinite(seq) ? seq : 0) + 1
    return `${period}${String(next).padStart(4, "0")}`
}

// ── ประวัติการเคลื่อนไหว (F7.4) ───────────────────────────────────────

export interface RecordHistoryInput {
    assetId: string
    action: AssetHistoryAction
    actorId: string
    fromUserId?: string | null
    toUserId?: string | null
    note?: string | null
}

/// บันทึกหนึ่งแถวในสมุดประวัติของครุภัณฑ์
///
/// รับ `client` เข้ามาได้เพื่อให้เรียกอยู่ใน `prisma.$transaction` เดียวกับการแก้ตัวครุภัณฑ์
export async function recordAssetHistory(
    input: RecordHistoryInput,
    client: Prisma.TransactionClient | typeof prisma = prisma
) {
    return client.assetHistory.create({
        data: {
            assetId: input.assetId,
            action: input.action,
            actorId: input.actorId,
            fromUserId: input.fromUserId ?? null,
            toUserId: input.toUserId ?? null,
            note: input.note ?? null,
        },
        select: assetHistorySelect,
    })
}

/// เติมชื่อคนลงในประวัติ — ใน DB เก็บเป็น id ล้วน จึงต้องดึงชื่อมาประกอบตอนแสดงผล
export async function attachHistoryNames(rows: AssetHistoryRow[]) {
    const ids = [
        ...new Set(
            rows
                .flatMap((r) => [r.actorId, r.fromUserId, r.toUserId])
                .filter((id): id is string => Boolean(id))
        ),
    ]

    const users = ids.length
        ? await prisma.user.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
          })
        : []
    const nameOf = new Map(users.map((u) => [u.id, u.name]))

    return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        actionLabel: ASSET_HISTORY_ACTION_LABEL[r.action as AssetHistoryAction] ?? r.action,
        actorName: nameOf.get(r.actorId) ?? null,
        fromUserName: r.fromUserId ? (nameOf.get(r.fromUserId) ?? null) : null,
        toUserName: r.toUserId ? (nameOf.get(r.toUserId) ?? null) : null,
    }))
}

// ── CSV นำเข้า/ส่งออก (F7.7) ──────────────────────────────────────────

/// หัวคอลัมน์ CSV → ชื่อฟิลด์ในระบบ
/// รับทั้งหัวไทย (ไฟล์ที่เจ้าหน้าที่ทำเอง) และหัวอังกฤษ (ไฟล์ที่ export ออกไปแล้วแก้กลับมา)
export const CSV_HEADER_MAP: Record<string, string> = {
    รหัสครุภัณฑ์: "assetCode",
    ชื่อครุภัณฑ์: "name",
    ประเภท: "type",
    ยี่ห้อ: "brand",
    รุ่น: "model",
    หมายเลขเครื่อง: "serialNumber",
    วันที่ซื้อ: "purchaseDate",
    ราคา: "price",
    วันหมดประกัน: "warrantyEndDate",
    สถานที่: "location",
    สถานะ: "status",
    หมายเหตุ: "note",
    assetCode: "assetCode",
    name: "name",
    type: "type",
    brand: "brand",
    model: "model",
    serialNumber: "serialNumber",
    purchaseDate: "purchaseDate",
    price: "price",
    warrantyEndDate: "warrantyEndDate",
    location: "location",
    status: "status",
    note: "note",
}

/// ลำดับคอลัมน์ของไฟล์ที่ระบบส่งออก — ใช้เป็นแม่แบบให้ผู้ใช้กรอกกลับมาได้เลย
export const CSV_COLUMNS = [
    "รหัสครุภัณฑ์",
    "ชื่อครุภัณฑ์",
    "ประเภท",
    "ยี่ห้อ",
    "รุ่น",
    "หมายเลขเครื่อง",
    "วันที่ซื้อ",
    "ราคา",
    "วันหมดประกัน",
    "สถานที่",
    "สถานะ",
    "ผู้ครอบครอง",
    "หน่วยงาน",
] as const

/// ป้ายไทย → ค่าที่เก็บจริง (ไฟล์ที่คนกรอกเองมักใส่คำไทย)
const LABEL_TO_STATUS = new Map(
    Object.entries(ASSET_STATUS_LABEL).map(([value, label]) => [label, value])
)
const LABEL_TO_TYPE = new Map(
    Object.entries(ASSET_TYPE_LABEL).map(([value, label]) => [label, value])
)

export function parseStatusCell(raw: string | undefined): string | null {
    const value = raw?.trim()
    if (!value) return null
    if (isAssetStatus(value)) return value
    return LABEL_TO_STATUS.get(value) ?? null
}

export function parseTypeCell(raw: string | undefined): string | null {
    const value = raw?.trim()
    if (!value) return null
    if (isAssetType(value)) return value
    return LABEL_TO_TYPE.get(value) ?? null
}

/// แปลงเซลล์วันที่จาก CSV — รองรับ "2026-09-02" และ "02/09/2569" (พ.ศ.)
export function parseDateCell(raw: string | undefined): Date | null {
    const value = raw?.trim()
    if (!value) return null

    const thai = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (thai) {
        const [, d, m, y] = thai
        const year = Number(y) > 2400 ? Number(y) - 543 : Number(y)
        const parsed = new Date(Date.UTC(year, Number(m) - 1, Number(d)))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseNumberCell(raw: string | undefined): number | null {
    const value = raw?.trim().replace(/,/g, "")
    if (!value) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

/// ครอบค่าหนึ่งช่องให้ปลอดภัยกับรูปแบบ CSV (คั่นด้วย , ครอบด้วย " และ escape " เป็น "")
function csvCell(value: unknown): string {
    if (value === null || value === undefined) return ""
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/// สร้างไฟล์ CSV จากรายการครุภัณฑ์ (F7.7)
/// นำหน้าด้วย BOM (U+FEFF) เพื่อให้ Excel บน Windows อ่านภาษาไทยไม่เป็นตัวต่างด้าว
const UTF8_BOM = "\u{FEFF}"

export function toAssetCsv(rows: AssetListRow[]): string {
    const lines = [CSV_COLUMNS.join(",")]

    for (const row of rows) {
        lines.push(
            [
                row.assetCode,
                row.name,
                isAssetType(row.type) ? ASSET_TYPE_LABEL[row.type] : row.type,
                row.brand,
                row.model,
                row.serialNumber,
                row.purchaseDate?.toISOString().slice(0, 10),
                decimalOrNull(row.price),
                row.warrantyEndDate?.toISOString().slice(0, 10),
                row.location,
                isAssetStatus(row.status) ? ASSET_STATUS_LABEL[row.status] : row.status,
                row.custodian?.name,
                row.department?.name,
            ]
                .map(csvCell)
                .join(",")
        )
    }

    return `${UTF8_BOM}${lines.join("\r\n")}\r\n`
}
