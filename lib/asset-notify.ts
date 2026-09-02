// lib/asset-notify.ts
// แจ้งเตือนครุภัณฑ์ใกล้หมดประกัน (F7.6, F8.6)
//
// ระบบยังไม่มีตัวตั้งเวลาในตัว การกวาดจึงเป็น endpoint ที่เรียกได้จากหน้าจอหรือ cron ภายนอก
// (`POST /api/assets/warranty`) — ตรรกะทั้งหมดอยู่ที่นี่เพื่อให้ย้ายไปผูก scheduler ทีหลังได้ง่าย

import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notification"
import { assetLink, assetWarrantyExpiring } from "@/lib/notification-templates"

/// ระยะเวลาที่ถือว่า "เพิ่งแจ้งไปแล้ว" — กันการแจ้งซ้ำทุกครั้งที่มีคนกดกวาด
const DEDUPE_DAYS = 30

/// ครุภัณฑ์เท่าที่การแจ้งเตือนต้องใช้
export interface NotifyAsset {
    id: string
    assetCode: string
    name: string
    warrantyEndDate: Date | null
    custodianId: string | null
    custodian?: { name: string } | null
}

/// เหลืออีกกี่วันถึงวันหมดประกัน — ปัดขึ้นเพื่อให้ "พรุ่งนี้หมด" อ่านว่าเหลือ 1 วัน ไม่ใช่ 0
export function daysUntil(date: Date, from: Date = new Date()): number {
    const ms = date.getTime() - from.getTime()
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/// วันที่แบบไทยสำหรับข้อความแจ้งเตือน (NFR4) — รูปแบบเดียวกับที่ `task-notify.ts` ใช้
function dateLabel(date: Date): string {
    return date.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

/// เคยแจ้งครุภัณฑ์ชิ้นนี้ให้คนนี้ไปแล้วในรอบ 30 วันหรือยัง
///
/// ใช้ `linkUrl` เป็นตัวชี้ว่าเป็นครุภัณฑ์ชิ้นไหน เพราะตาราง `Notification` ไม่ได้เก็บ id
/// ของสิ่งที่ถูกอ้างถึงแยกไว้ และลิงก์ของครุภัณฑ์หนึ่งชิ้นคงที่เสมอ
async function alreadyNotified(userId: string, assetId: string): Promise<boolean> {
    const since = new Date()
    since.setDate(since.getDate() - DEDUPE_DAYS)

    const existing = await prisma.notification.findFirst({
        where: {
            userId,
            type: "asset_warranty_expiring",
            linkUrl: assetLink({ id: assetId }),
            createdAt: { gte: since },
        },
        select: { id: true },
    })
    return existing !== null
}

export interface WarrantySweepResult {
    /// จำนวนครุภัณฑ์ที่เข้าเงื่อนไขใกล้หมดประกัน
    matched: number
    /// จำนวนการแจ้งเตือนที่ส่งออกจริง (ไม่นับที่ข้ามเพราะเพิ่งแจ้งไป หรือไม่มีผู้ครอบครอง)
    notified: number
    /// รหัสครุภัณฑ์ที่ข้ามไปเพราะยังไม่มีผู้ครอบครองให้แจ้ง
    skippedNoCustodian: string[]
}

/// แจ้งผู้ครอบครองของครุภัณฑ์ที่ใกล้หมดประกันทุกชิ้นในชุดที่ส่งเข้ามา (F7.6)
///
/// ครุภัณฑ์ที่ยังไม่มีผู้ครอบครองจะถูกข้าม แล้วคืนรหัสกลับไปให้หน้าจอแสดงเป็นรายการที่ต้องตามเอง
export async function notifyWarrantyExpiring(
    assets: NotifyAsset[]
): Promise<WarrantySweepResult> {
    const result: WarrantySweepResult = {
        matched: assets.length,
        notified: 0,
        skippedNoCustodian: [],
    }

    for (const asset of assets) {
        if (!asset.warrantyEndDate) continue

        if (!asset.custodianId) {
            result.skippedNoCustodian.push(asset.assetCode)
            continue
        }

        if (await alreadyNotified(asset.custodianId, asset.id)) continue

        const sent = await notify({
            ...assetWarrantyExpiring(asset, {
                daysLeft: daysUntil(asset.warrantyEndDate),
                endDateLabel: dateLabel(asset.warrantyEndDate),
                custodianName: asset.custodian?.name ?? null,
            }),
            userId: asset.custodianId,
            // ผู้กดกวาดมักเป็นเจ้าหน้าที่ทะเบียน ไม่ใช่ผู้ครอบครอง — แต่ถ้าบังเอิญเป็นคนเดียวกัน
            // ก็ยังควรได้รับแจ้ง เพราะเป็นการเตือนตามกำหนดเวลา ไม่ใช่ผลจากการกระทำของเขาเอง
            skipIfActor: null,
        })

        if (sent) result.notified += 1
    }

    return result
}
