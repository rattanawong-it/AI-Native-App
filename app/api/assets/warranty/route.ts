// app/api/assets/warranty/route.ts
// GET  — รายการครุภัณฑ์ที่ประกันจะหมดภายใน N วัน (F7.6)
// POST — กวาดรายการนั้นแล้วส่งแจ้งเตือนให้ผู้ครอบครองแต่ละคน (F7.6, F8.6)
//
// ระบบยังไม่มีตัวตั้งเวลาในตัว — POST จึงถูกออกแบบให้เรียกซ้ำได้อย่างปลอดภัย
// (มีตัวกันแจ้งซ้ำ 30 วันใน `lib/asset-notify.ts`) จะกดจากหน้าจอหรือให้ cron ภายนอกยิงก็ได้

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { assetListSelect, toAssetDto, warrantyDeadline } from "@/lib/asset-service"
import { notifyWarrantyExpiring } from "@/lib/asset-notify"

/// ระยะเตือนเริ่มต้น — 90 วันพอให้ตั้งงบต่อประกันทันในรอบไตรมาส
const DEFAULT_DAYS = 90
const MAX_DAYS = 365

/// อ่านช่วงวันจาก query string — คืน `null` เมื่อค่าที่ส่งมาใช้ไม่ได้
function readDays(url: URL): number | null {
    const raw = url.searchParams.get("days")
    if (raw === null) return DEFAULT_DAYS
    const days = Number(raw)
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return null
    return days
}

/// ครุภัณฑ์ที่ประกันเหลือไม่เกิน `days` วัน และยังไม่ถูกจำหน่าย
function expiringWhere(days: number) {
    return {
        status: { not: "disposed" },
        warrantyEndDate: { gte: new Date(), lte: warrantyDeadline(days) },
    }
}

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response

    const days = readDays(new URL(request.url))
    if (days === null) return badRequest(`จำนวนวันต้องเป็นจำนวนเต็ม 1–${MAX_DAYS}`)

    try {
        const assets = await prisma.asset.findMany({
            where: expiringWhere(days),
            select: assetListSelect,
            orderBy: { warrantyEndDate: "asc" },
        })

        return NextResponse.json({ days, total: assets.length, assets: assets.map(toAssetDto) })
    } catch (error) {
        console.error("Asset warranty GET Error:", error)
        return NextResponse.json(
            { error: "ไม่สามารถโหลดรายการครุภัณฑ์ใกล้หมดประกันได้" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole(["manager", "admin"])
    if (!guard.ok) return guard.response

    const days = readDays(new URL(request.url))
    if (days === null) return badRequest(`จำนวนวันต้องเป็นจำนวนเต็ม 1–${MAX_DAYS}`)

    try {
        const assets = await prisma.asset.findMany({
            where: expiringWhere(days),
            select: {
                id: true,
                assetCode: true,
                name: true,
                warrantyEndDate: true,
                custodianId: true,
                custodian: { select: { name: true } },
            },
            orderBy: { warrantyEndDate: "asc" },
        })

        const result = await notifyWarrantyExpiring(assets)

        return NextResponse.json({ days, ...result })
    } catch (error) {
        console.error("Asset warranty POST Error:", error)
        return NextResponse.json({ error: "ส่งการแจ้งเตือนไม่สำเร็จ" }, { status: 500 })
    }
}
