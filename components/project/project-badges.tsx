"use client"

// components/project/project-badges.tsx
// ป้ายกำกับที่ใช้ซ้ำทุกหน้าของกลุ่ม SDLC — สีทั้งหมดมาจาก design token ใน app/globals.css
// อ้างอิง F5.1, F5.3, F5.4 และยึดรูปแบบเดียวกับ components/ticket/ticket-badges.tsx

import { cn } from "@/lib/utils"
import {
    BOARD_STATUS_BADGE_CLASS,
    BOARD_STATUS_DOT,
    BOARD_STATUS_LABEL,
    PROJECT_STATUS_BADGE_CLASS,
    PROJECT_STATUS_LABEL,
    SPRINT_STATUS_BADGE_CLASS,
    SPRINT_STATUS_LABEL,
    TEAM_ROLE_LABEL,
    type BoardStatus,
    type ProjectStatus,
    type SprintStatus,
    type TeamRole,
} from "@/lib/task-board"

/// `w-fit` จำเป็นเพราะป้ายเหล่านี้ถูกวางเป็นลูกของ grid/flex ที่ยืดเต็มความกว้าง
const pill =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"

export function BoardStatusBadge({ status, className }: { status: string; className?: string }) {
    const s = (status in BOARD_STATUS_LABEL ? status : "backlog") as BoardStatus
    return (
        <span className={cn(pill, BOARD_STATUS_BADGE_CLASS[s], className)}>
            <span className={cn("size-1.5 rounded-full", BOARD_STATUS_DOT[s])} aria-hidden />
            {BOARD_STATUS_LABEL[s]}
        </span>
    )
}

export function ProjectStatusBadge({ status, className }: { status: string; className?: string }) {
    const s = (status in PROJECT_STATUS_LABEL ? status : "planning") as ProjectStatus
    return (
        <span className={cn(pill, PROJECT_STATUS_BADGE_CLASS[s], className)}>
            {PROJECT_STATUS_LABEL[s]}
        </span>
    )
}

export function SprintStatusBadge({ status, className }: { status: string; className?: string }) {
    const s = (status in SPRINT_STATUS_LABEL ? status : "planned") as SprintStatus
    return (
        <span className={cn(pill, SPRINT_STATUS_BADGE_CLASS[s], className)}>
            {SPRINT_STATUS_LABEL[s]}
        </span>
    )
}

export function TeamRoleBadge({ role, className }: { role: string; className?: string }) {
    const r = (role in TEAM_ROLE_LABEL ? role : "member") as TeamRole
    return (
        <span
            className={cn(
                pill,
                r === "leader"
                    ? "bg-brand-tint text-brand"
                    : "bg-priority-low-bg text-priority-low-fg",
                className
            )}
        >
            {TEAM_ROLE_LABEL[r]}
        </span>
    )
}

/// แถบความคืบหน้าของโครงการ / Sprint — สีเปลี่ยนตามระดับเพื่ออ่านสถานะได้จากระยะไกล
export function ProgressBar({
    value,
    className,
    showLabel = true,
}: {
    value: number
    className?: string
    showLabel?: boolean
}) {
    const pct = Math.min(100, Math.max(0, Math.round(value)))
    const tone =
        pct >= 100
            ? "bg-status-resolved"
            : pct >= 60
              ? "bg-status-new"
              : pct >= 30
                ? "bg-status-progress"
                : "bg-priority-low"

    return (
        <div className={cn("space-y-1.5", className)}>
            {showLabel && (
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ความคืบหน้า</span>
                    <span className="font-semibold">{pct}%</span>
                </div>
            )}
            <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", tone)}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
