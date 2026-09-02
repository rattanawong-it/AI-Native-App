// lib/worklog-types.ts
// รูปร่างข้อมูลที่ API ของ My Work / To-do / Time Log คืนกลับมา — ใช้ร่วมกันทุก client component
// ค่าวันที่เป็น string เพราะผ่าน JSON มาแล้ว
// อ้างอิง docs/spec.md §8 ③ (F3.1–F3.8)

import type { Person } from "@/lib/ticket-types"

// ── งานส่วนตัว (F3.3, F3.4) ──────────────────────────────────────────

export interface TodoRow {
    id: string
    ownerId: string
    title: string
    note: string | null
    dueDate: string | null
    priority: string
    isDone: boolean
    doneAt: string | null
    createdAt: string
    updatedAt: string
    _count: { workLogs: number }
}

export interface TodoListResponse {
    todos: TodoRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

// ── Time Log (F3.5) ──────────────────────────────────────────────────

export interface WorkLogRow {
    id: string
    userId: string
    workDate: string
    hours: number
    description: string
    refType: string
    refLabel: string
    refTitle: string | null
    refHref: string | null
    ticketId: string | null
    taskId: string | null
    todoId: string | null
    createdAt: string
    user: Person
}

export interface WorkLogListResponse {
    workLogs: WorkLogRow[]
    total: number
    totalHours: number
    page: number
    pageSize: number
    totalPages: number
}

// ── My Work (F3.1, F3.2) ─────────────────────────────────────────────

export interface WorkItem {
    kind: "ticket" | "task" | "todo"
    id: string
    title: string
    code: string | null
    status: string
    priority: string
    dueDate: string | null
    isDone: boolean
    href: string | null
    context: string | null
    updatedAt: string
}

export interface MyWorkResponse {
    items: WorkItem[]
    counts: {
        all: number
        ticket: number
        task: number
        todo: number
        overdue: number
        today: number
    }
    truncated: boolean
}

// ── สรุปชั่วโมง (F3.7, F3.8) ─────────────────────────────────────────

export interface HoursBucket {
    key: string
    label: string
    hours: number
    entries: number
}

export interface WorkLogSummary {
    range: { from: string; to: string; label: string }
    period: "day" | "week" | "month"
    scope: "own" | "team"
    totalHours: number
    totalEntries: number
    /// จำนวนวันในช่วงที่มีการบันทึกเวลาอย่างน้อยหนึ่งรายการ
    daysLogged: number
    byDay: HoursBucket[]
    byRefType: HoursBucket[]
    /// รายคน — มีเฉพาะเมื่อ scope = team (F3.8)
    byUser: (HoursBucket & { openTickets: number })[]
}

// ── ตั้งค่าที่หน้าจอแก้ได้ (F3.6) ────────────────────────────────────

export interface AppSettingRow {
    key: string
    value: boolean
    description: string | null
}

// ── ป้ายกำกับที่ใช้ในหน้าจอ ──────────────────────────────────────────

/// ชนิดงานในมุมมองรวม
export const WORK_KIND_LABEL: Record<WorkItem["kind"], string> = {
    ticket: "Ticket",
    task: "Task โครงการ",
    todo: "งานส่วนตัว",
}

/// สถานะของ Task บนกระดาน (Phase 5 จะใช้ชุดเดียวกันนี้)
export const TASK_STATUS_LABEL: Record<string, string> = {
    backlog: "รอจัดคิว",
    todo: "รอเริ่ม",
    doing: "กำลังทำ",
    review: "รอตรวจ",
    done: "เสร็จแล้ว",
}

/// "1.5" → "1 ชม. 30 น." — ใช้แสดงชั่วโมงสะสมให้อ่านง่าย
export function formatHours(hours: number): string {
    if (!Number.isFinite(hours) || hours <= 0) return "0 ชม."
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    if (h === 0) return `${m} น.`
    if (m === 0) return `${h} ชม.`
    return `${h} ชม. ${m} น.`
}

/// ป้ายวันที่แบบสั้นสำหรับแกนของตารางสรุป — "1 ก.ย."
export function shortThaiDay(iso: string): string {
    const d = new Date(`${iso}T00:00:00.000+07:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
    })
}
