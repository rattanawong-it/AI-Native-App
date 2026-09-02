"use client"

// components/asset/asset-badges.tsx
// ป้ายกำกับที่ใช้ซ้ำทุกหน้าของทะเบียนครุภัณฑ์ — สีทั้งหมดมาจาก design token ใน app/globals.css
// อ้างอิง F7.3 (สถานะครุภัณฑ์) และ F7.6 (เตือนใกล้หมดประกัน)

import { cn } from "@/lib/utils"
import { ShieldAlert, ShieldCheck } from "lucide-react"
import { ASSET_STATUS_LABEL, ASSET_TYPE_LABEL, type AssetStatus, type AssetType } from "@/lib/asset-workflow"

/// `w-fit` ด้วยเหตุผลเดียวกับ kb-badges — ป้ายถูกวางเป็นลูกของ grid ในหน้ารายการ
const pill =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"

/// เขียนคลาสเต็มเพื่อให้ Tailwind JIT มองเห็น (ห้ามประกอบชื่อคลาสด้วย string interpolation)
const ASSET_STATUS_BADGE_CLASS: Record<AssetStatus, string> = {
    in_use: "bg-status-assigned-bg text-status-assigned-fg",
    in_stock: "bg-status-new-bg text-status-new-fg",
    repair: "bg-status-progress-bg text-status-progress-fg",
    disposed: "bg-status-closed-bg text-status-closed-fg",
}

export function AssetStatusBadge({ status, className }: { status: string; className?: string }) {
    const s = (status in ASSET_STATUS_LABEL ? status : "in_stock") as AssetStatus
    return (
        <span className={cn(pill, ASSET_STATUS_BADGE_CLASS[s], className)}>
            {ASSET_STATUS_LABEL[s]}
        </span>
    )
}

export function AssetTypeBadge({ type, className }: { type: string; className?: string }) {
    const t = (type in ASSET_TYPE_LABEL ? type : "other") as AssetType
    return (
        <span className={cn(pill, "bg-muted text-muted-foreground", className)}>
            {ASSET_TYPE_LABEL[t]}
        </span>
    )
}

/// เหลืออีกกี่วันถึงวันหมดประกัน — ค่าติดลบแปลว่าหมดไปแล้ว
function daysLeft(warrantyEndDate: string): number {
    const ms = new Date(warrantyEndDate).getTime() - Date.now()
    return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/// ธงเตือนประกัน (F7.6) — เงียบไว้เมื่อยังเหลือเวลาเยอะ เพื่อให้ป้ายที่โผล่มามีความหมายจริง
export function AssetWarrantyBadge({
    warrantyEndDate,
    withinDays = 90,
    className,
}: {
    warrantyEndDate: string | null
    withinDays?: number
    className?: string
}) {
    if (!warrantyEndDate) return null

    const left = daysLeft(warrantyEndDate)
    if (left > withinDays) return null

    if (left < 0) {
        return (
            <span className={cn(pill, "bg-status-closed-bg text-status-closed-fg", className)}>
                <ShieldCheck className="size-3" aria-hidden />
                หมดประกันแล้ว
            </span>
        )
    }

    return (
        <span className={cn(pill, "bg-destructive/10 text-destructive", className)}>
            <ShieldAlert className="size-3" aria-hidden />
            ประกันเหลือ {left} วัน
        </span>
    )
}
