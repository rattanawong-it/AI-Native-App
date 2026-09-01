// lib/ticket-types.ts
// รูปร่างข้อมูลที่ API ของ Helpdesk คืนกลับมา — ใช้ร่วมกันทุก client component
// ค่าวันที่เป็น string เพราะผ่าน JSON มาแล้ว

import type { SlaInfo } from "@/components/ticket/ticket-badges"

export interface Person {
    id: string
    name: string
    email: string
    image: string | null
}

export interface TicketRow {
    id: string
    ticketNo: string
    title: string
    status: string
    priority: string
    impact: string
    urgency: string
    channel: string
    createdAt: string
    updatedAt: string
    respondedAt: string | null
    resolvedAt: string | null
    closedAt: string | null
    responseDueAt: string | null
    resolutionDueAt: string | null
    responseBreached: boolean
    resolutionBreached: boolean
    category: { id: string; name: string; slug: string }
    requester: Person
    assignee: Person | null
    team: { id: string; name: string } | null
    _count: { comments: number }
    sla: SlaInfo | null
}

export interface TicketDetail extends TicketRow {
    description: string
    resolutionNote: string | null
    departmentId: string | null
    department: { id: string; name: string } | null
    requesterId: string
    assigneeId: string | null
    teamId: string | null
    categoryId: string
}

export interface TicketComment {
    id: string
    body: string
    isInternal: boolean
    createdAt: string
    author: Person
}

export interface TicketActivity {
    id: string
    action: string
    fromValue: string | null
    toValue: string | null
    note: string | null
    createdAt: string
    actor: Person
}

export interface Category {
    id: string
    name: string
    slug: string
    parentId: string | null
    description: string | null
    defaultTeamId: string | null
    defaultAssigneeId: string | null
    active: boolean
    sortOrder: number
    defaultTeam: { id: string; name: string } | null
    defaultAssignee: { id: string; name: string } | null
    _count: { tickets: number }
}

export interface DirectoryAgent {
    id: string
    name: string
    email: string
    image: string | null
    position: string | null
    role: string
}

export interface DirectoryTeam {
    id: string
    name: string
    description: string | null
}

export interface TicketListResponse {
    tickets: TicketRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface TicketDetailResponse {
    ticket: TicketDetail
    comments: TicketComment[]
    activities: TicketActivity[]
    can: { update: boolean; comment: boolean; internalNote: boolean }
}

// ── ตัวช่วยจัดรูปแบบวันเวลาไทย (ใช้ทุกหน้า) ──────────────────────────

const TH_OPTS: Intl.DateTimeFormatOptions = { timeZone: "Asia/Bangkok" }

/// "29 ส.ค. 2569 08:16"
export function formatThaiDateTime(value: string | Date | null | undefined): string {
    if (!value) return "-"
    const d = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return "-"
    return d.toLocaleString("th-TH", {
        ...TH_OPTS,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/// "29 ส.ค. 2569"
export function formatThaiDate(value: string | Date | null | undefined): string {
    if (!value) return "-"
    const d = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return "-"
    return d.toLocaleDateString("th-TH", {
        ...TH_OPTS,
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

/// "3 นาทีที่แล้ว" — ใช้ใน timeline และรายการความคิดเห็น
export function formatRelative(value: string | Date): string {
    const d = typeof value === "string" ? new Date(value) : value
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)

    if (mins < 1) return "เมื่อสักครู่"
    if (mins < 60) return `${mins} นาทีที่แล้ว`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} วันที่แล้ว`
    return formatThaiDate(d)
}

/// อ่านข้อความ error จาก response ของ API (ทุกเส้นคืน { error: string })
export async function readError(res: Response, fallback = "เกิดข้อผิดพลาด"): Promise<string> {
    try {
        const data = (await res.json()) as { error?: string }
        return data.error || fallback
    } catch {
        return fallback
    }
}

/// สร้าง slug จากชื่อหมวดหมู่ให้พร้อมใช้กับ API ทันที
///
/// API บังคับรูปแบบ `[a-z0-9-]` เท่านั้น จึงต้องตัดอักษรไทยทิ้ง — ต่างจาก
/// `slugify()` ใน lib/running-number.ts ที่เก็บอักษรไทยไว้ได้เพราะ slug ของ KB ไม่ได้บังคับ
/// คืนค่าว่างเมื่อชื่อไม่มีตัวอักษรละติน/ตัวเลขเลย ให้ผู้ใช้กรอก slug เองแทนการเดา
export function slugifyClient(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
}
