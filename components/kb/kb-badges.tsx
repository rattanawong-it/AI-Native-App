"use client"

// components/kb/kb-badges.tsx
// ป้ายกำกับที่ใช้ซ้ำทุกหน้าของ Knowledge Base — สีทั้งหมดมาจาก design token ใน app/globals.css
// อ้างอิง F6.4 (สถานะบทความ) และ F6.6 (ระดับการมองเห็น)

import { cn } from "@/lib/utils"
import { Eye, EyeOff, Sparkles } from "lucide-react"
import {
    KB_STATUS_LABEL,
    KB_VISIBILITY_LABEL,
    type KbStatus,
    type KbVisibility,
} from "@/lib/kb-workflow"

/// `w-fit` ด้วยเหตุผลเดียวกับ ticket-badges — ป้ายถูกวางเป็นลูกของ grid ในหน้ารายการ
const pill =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"

/// เขียนคลาสเต็มเพื่อให้ Tailwind JIT มองเห็น (ห้ามประกอบชื่อคลาสด้วย string interpolation)
const KB_STATUS_BADGE_CLASS: Record<KbStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    pending_review: "bg-status-progress-bg text-status-progress-fg",
    published: "bg-status-resolved-bg text-status-resolved-fg",
    archived: "bg-status-closed-bg text-status-closed-fg",
}

export function KbStatusBadge({ status, className }: { status: string; className?: string }) {
    const s = (status in KB_STATUS_LABEL ? status : "draft") as KbStatus
    return (
        <span className={cn(pill, KB_STATUS_BADGE_CLASS[s], className)}>
            {KB_STATUS_LABEL[s]}
        </span>
    )
}

export function KbVisibilityBadge({
    visibility,
    className,
}: {
    visibility: string
    className?: string
}) {
    const v = (visibility in KB_VISIBILITY_LABEL ? visibility : "all") as KbVisibility
    const Icon = v === "all" ? Eye : EyeOff
    return (
        <span className={cn(pill, "bg-muted text-muted-foreground", className)}>
            <Icon className="size-3" aria-hidden />
            {KB_VISIBILITY_LABEL[v]}
        </span>
    )
}

/// ธงบอกว่าบทความถูก sync เข้าคลังค้นหาของแชตบอทแล้ว (F6.9)
/// แสดงเฉพาะตอนยังไม่ถูก index เพราะเป็นกรณีที่ต้องให้ผู้ใช้เห็นและกดสั่งซ้ำได้
export function KbIndexBadge({ isIndexed, status }: { isIndexed: boolean; status: string }) {
    if (status !== "published") return null

    return isIndexed ? (
        <span className={cn(pill, "bg-status-new-bg text-status-new-fg")}>
            <Sparkles className="size-3" aria-hidden />
            อยู่ในคลังค้นหา
        </span>
    ) : (
        <span className={cn(pill, "bg-destructive/10 text-destructive")}>
            ยังไม่เข้าคลังค้นหา
        </span>
    )
}

/// แท็กบทความ — กดแล้วส่งค่ากลับให้หน้ารายการใช้กรอง (F6.3)
export function KbTagChip({
    tag,
    onClick,
    active,
}: {
    tag: string
    onClick?: (tag: string) => void
    active?: boolean
}) {
    const className = cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
        active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/70"
    )

    if (!onClick) return <span className={className}>#{tag}</span>

    return (
        <button type="button" className={className} onClick={() => onClick(tag)}>
            #{tag}
        </button>
    )
}
