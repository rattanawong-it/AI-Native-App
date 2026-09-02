"use client"

// components/approval/approval-badges.tsx
// ป้ายกำกับที่ใช้ซ้ำทุกหน้าของคำขออนุมัติ — สีทั้งหมดมาจาก design token ใน app/globals.css
// อ้างอิง F7.9 (ประเภทคำขอ) และ F7.11 (สถานะ)

import { cn } from "@/lib/utils"
import { Check, Clock, Minus, X } from "lucide-react"
import {
    APPROVAL_STATUS_LABEL,
    APPROVAL_STEP_STATUS_LABEL,
    APPROVAL_TYPE_LABEL,
    type ApprovalStatus,
    type ApprovalStepStatus,
    type ApprovalType,
} from "@/lib/approval-workflow"

const pill =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"

/// เขียนคลาสเต็มเพื่อให้ Tailwind JIT มองเห็น (ห้ามประกอบชื่อคลาสด้วย string interpolation)
const APPROVAL_STATUS_BADGE_CLASS: Record<ApprovalStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-status-progress-bg text-status-progress-fg",
    approved: "bg-status-resolved-bg text-status-resolved-fg",
    rejected: "bg-destructive/10 text-destructive",
    cancelled: "bg-status-closed-bg text-status-closed-fg",
}

export function ApprovalStatusBadge({
    status,
    className,
}: {
    status: string
    className?: string
}) {
    const s = (status in APPROVAL_STATUS_LABEL ? status : "draft") as ApprovalStatus
    return (
        <span className={cn(pill, APPROVAL_STATUS_BADGE_CLASS[s], className)}>
            {APPROVAL_STATUS_LABEL[s]}
        </span>
    )
}

export function ApprovalTypeBadge({ type, className }: { type: string; className?: string }) {
    const t = (type in APPROVAL_TYPE_LABEL ? type : "other") as ApprovalType
    return (
        <span className={cn(pill, "bg-muted text-muted-foreground", className)}>
            {APPROVAL_TYPE_LABEL[t]}
        </span>
    )
}

const STEP_ICON: Record<ApprovalStepStatus, typeof Check> = {
    pending: Clock,
    approved: Check,
    rejected: X,
}

const STEP_CLASS: Record<ApprovalStepStatus, string> = {
    pending: "bg-status-progress-bg text-status-progress-fg",
    approved: "bg-status-resolved-bg text-status-resolved-fg",
    rejected: "bg-destructive/10 text-destructive",
}

/// สถานะของ "ขั้น" หนึ่งขั้น — ใช้ในแถบไล่ขั้นและใน timeline (F7.10, F7.14)
export function ApprovalStepBadge({ status, className }: { status: string; className?: string }) {
    const s = (
        status in APPROVAL_STEP_STATUS_LABEL ? status : "pending"
    ) as ApprovalStepStatus
    const Icon = STEP_ICON[s] ?? Minus
    return (
        <span className={cn(pill, STEP_CLASS[s], className)}>
            <Icon className="size-3" aria-hidden />
            {APPROVAL_STEP_STATUS_LABEL[s]}
        </span>
    )
}
