"use client"

// components/ticket/ticket-badges.tsx
// ป้ายกำกับที่ใช้ซ้ำทุกหน้าของ Helpdesk — สีทั้งหมดมาจาก design token ใน app/globals.css
// อ้างอิง F2.3 (Badge สี Priority ทั่วระบบ) และ F4.8 (SLA Indicator)

import { cn } from "@/lib/utils"
import {
    PRIORITY_LABEL,
    PRIORITY_BADGE_CLASS,
    IMPACT_LABEL,
    URGENCY_LABEL,
    type Priority,
    type Impact,
    type Urgency,
} from "@/lib/priority"
import {
    TICKET_STATUS_LABEL,
    TICKET_STATUS_BADGE_CLASS,
    TICKET_CHANNEL_LABEL,
    type TicketStatus,
    type TicketChannel,
} from "@/lib/ticket-workflow"

const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"

/// จุดสีนำหน้าข้อความในป้าย
function Dot({ className }: { className: string }) {
    return <span className={cn("size-1.5 rounded-full", className)} aria-hidden />
}

/// คลาสจุดสีของ Priority — เขียนเต็มคลาสเพื่อให้ Tailwind JIT มองเห็น
const PRIORITY_DOT: Record<Priority, string> = {
    critical: "bg-priority-critical",
    high: "bg-priority-high",
    medium: "bg-priority-medium",
    low: "bg-priority-low",
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
    const p = (priority in PRIORITY_LABEL ? priority : "low") as Priority
    return (
        <span className={cn(pill, PRIORITY_BADGE_CLASS[p], className)}>
            <Dot className={PRIORITY_DOT[p]} />
            {PRIORITY_LABEL[p]}
        </span>
    )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const s = status as TicketStatus
    return (
        <span
            className={cn(pill, TICKET_STATUS_BADGE_CLASS[s] ?? TICKET_STATUS_BADGE_CLASS.new, className)}
        >
            {TICKET_STATUS_LABEL[s] ?? status}
        </span>
    )
}

export function ChannelLabel({ channel }: { channel: string }) {
    return <>{TICKET_CHANNEL_LABEL[channel as TicketChannel] ?? channel}</>
}

/// แสดง Impact × Urgency เป็นข้อความสั้นใต้ Priority
export function ImpactUrgencyText({ impact, urgency }: { impact: string; urgency: string }) {
    return (
        <>
            ผลกระทบ: {IMPACT_LABEL[impact as Impact] ?? impact} · ความเร่งด่วน:{" "}
            {URGENCY_LABEL[urgency as Urgency] ?? urgency}
        </>
    )
}

// ── SLA Indicator (F4.8, F4.9) ───────────────────────────────────────

export interface SlaInfo {
    status: "on_time" | "at_risk" | "breached"
    ratio: number
    remainingMinutes: number
    target: "response" | "resolution" | "done"
}

const SLA_DOT: Record<SlaInfo["status"], string> = {
    on_time: "bg-sla-ontime",
    at_risk: "bg-sla-atrisk",
    breached: "bg-sla-breached",
}

const SLA_TEXT: Record<SlaInfo["status"], string> = {
    on_time: "text-sla-ontime",
    at_risk: "text-sla-atrisk",
    breached: "text-sla-breached",
}

const SLA_BAR: Record<SlaInfo["status"], string> = {
    on_time: "bg-sla-ontime",
    at_risk: "bg-sla-atrisk",
    breached: "bg-sla-breached",
}

/// แปลงนาทีทำการเป็นข้อความไทยสั้นๆ — 8 ชม. = 1 วันทำการ
export function formatRemaining(minutes: number): string {
    const abs = Math.abs(Math.round(minutes))
    const days = Math.floor(abs / 480)
    const hours = Math.floor((abs % 480) / 60)
    const mins = abs % 60

    if (days > 0) return `${days} วัน${hours > 0 ? ` ${hours} ชม.` : ""}`
    if (hours > 0) return `${hours} ชม.${mins > 0 ? ` ${mins} น.` : ""}`
    return `${mins} นาที`
}

/// ข้อความสรุปสถานะ SLA ที่แสดงข้างจุดสี
export function slaText(sla: SlaInfo): string {
    if (sla.target === "done") {
        return sla.status === "breached" ? "ปิดเกินกำหนด" : "ปิดตรงเวลา"
    }
    const what = sla.target === "response" ? "ตอบกลับ" : "แก้ไข"
    if (sla.status === "breached") return `เกินกำหนด${what} ${formatRemaining(sla.remainingMinutes)}`
    return `${what}ใน ${formatRemaining(sla.remainingMinutes)}`
}

export function SlaIndicator({ sla, className }: { sla: SlaInfo | null; className?: string }) {
    if (!sla) return <span className="text-muted-foreground text-xs">—</span>
    return (
        <span className={cn("inline-flex items-center gap-2 text-xs whitespace-nowrap", className)}>
            <Dot className={SLA_DOT[sla.status]} />
            <span className={sla.status === "on_time" ? "text-muted-foreground" : SLA_TEXT[sla.status]}>
                {slaText(sla)}
            </span>
        </span>
    )
}

/// แถบความคืบหน้า SLA สำหรับหน้ารายละเอียด (F4.9)
export function SlaProgressBar({ sla }: { sla: SlaInfo | null }) {
    if (!sla || sla.target === "done") return null
    const pct = Math.min(100, Math.max(0, Math.round(sla.ratio * 100)))
    return (
        <div className="space-y-2">
            <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                    className={cn("h-full rounded-full transition-all", SLA_BAR[sla.status])}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className={cn("text-sm font-medium", SLA_TEXT[sla.status])}>{slaText(sla)}</p>
        </div>
    )
}

// ── Avatar ตัวอักษรย่อ (ใช้แทนรูปเมื่อผู้ใช้ไม่มีรูปโปรไฟล์) ──────────

/// ตัวย่อจากชื่อไทย/อังกฤษ — ไทยใช้อักษรตัวแรกของ 2 คำแรก
export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2)
    return parts[0][0] + parts[1][0]
}

export function PersonChip({
    person,
    size = 28,
    className,
    avatarOnly = false,
}: {
    person: { name: string; image?: string | null } | null
    size?: number
    className?: string
    /// แสดงเฉพาะรูป/ตัวย่อ ไม่ต้องมีชื่อต่อท้าย (ใช้ในรายการความคิดเห็น)
    avatarOnly?: boolean
}) {
    if (!person) {
        return <span className="text-muted-foreground text-sm">ยังไม่มอบหมาย</span>
    }
    return (
        <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
            {person.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={person.image}
                    alt={person.name}
                    width={size}
                    height={size}
                    className="rounded-full object-cover"
                    style={{ width: size, height: size }}
                />
            ) : (
                <span
                    className="bg-brand-tint text-brand flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ width: size, height: size }}
                >
                    {initialsOf(person.name)}
                </span>
            )}
            {!avatarOnly && <span className="truncate text-sm">{person.name}</span>}
        </span>
    )
}
