// lib/project-types.ts
// รูปร่างข้อมูลที่ API ของกลุ่ม SDLC คืนกลับมา — ใช้ร่วมกันทุก client component
// ค่าวันที่เป็น string เพราะผ่าน JSON มาแล้ว
// อ้างอิง docs/spec.md §8 ⑤ (F5.1–F5.13)

import { formatThaiDate, type Person } from "@/lib/ticket-types"
import type { BoardStatus } from "@/lib/task-board"

// ── โครงการ (F5.1, F5.2) ─────────────────────────────────────────────

export interface ProjectRow {
    id: string
    code: string
    name: string
    description: string | null
    status: string
    ownerId: string
    teamId: string | null
    startDate: string | null
    endDate: string | null
    progress: number
    createdAt: string
    updatedAt: string
    owner: Person
    team: { id: string; name: string; _count: { members: number } } | null
    _count: { tasks: number; sprints: number }
    /// จำนวน Task ที่ปิดงานแล้ว — คำนวณฝั่ง API เพื่อให้การ์ดแสดง "12/30 งาน" ได้
    doneTasks: number
}

export interface ProjectListResponse {
    projects: ProjectRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    /// จำนวนโครงการแยกตามสถานะ (นับจากทั้งระบบ ไม่ใช่เฉพาะหน้าปัจจุบัน)
    statusCounts: Record<string, number>
}

export interface ProjectDetail extends ProjectRow {
    sprints: SprintRow[]
    board: BoardSummary
}

// ── Sprint (F5.3, F5.12) ─────────────────────────────────────────────

export interface SprintRow {
    id: string
    projectId: string
    name: string
    goal: string | null
    startDate: string
    endDate: string
    status: string
    sortOrder: number
    createdAt: string
    updatedAt: string
    _count: { tasks: number }
}

// ── Task (F5.4–F5.7) ─────────────────────────────────────────────────

export interface TaskCard {
    id: string
    projectId: string
    sprintId: string | null
    title: string
    boardStatus: string
    priority: string
    assigneeId: string | null
    estimateHours: number | null
    /// ชั่วโมงที่ลงเวลาไว้จริงกับงานใบนี้ (รวมจาก Time Log ของเฟส 3)
    loggedHours: number
    dueDate: string | null
    sortOrder: number
    sourceTicketId: string | null
    createdAt: string
    updatedAt: string
    assignee: Person | null
    sourceTicket: { id: string; ticketNo: string; title: string } | null
    _count: { comments: number; workLogs: number }
}

export interface TaskDetail extends TaskCard {
    description: string | null
    createdBy: string
    project: { id: string; code: string; name: string; status: string }
    sprint: { id: string; name: string; status: string } | null
}

export interface TaskComment {
    id: string
    taskId: string
    body: string
    createdAt: string
    author: Person
}

export interface TaskListResponse {
    tasks: TaskCard[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface TaskDetailResponse {
    task: TaskDetail
    comments: TaskComment[]
}

// ── กระดาน (F5.4, F5.12) ─────────────────────────────────────────────

export interface BoardSummary {
    counts: Record<string, number>
    total: number
    done: number
    progress: number
    estimateTotal: number
    estimateDone: number
    loggedTotal: number
}

export interface BoardResponse {
    tasks: TaskCard[]
    summary: BoardSummary
    /// สรุปของ Sprint ที่กำลังดูอยู่ — null เมื่อดูทั้งโครงการหรือดู Backlog
    sprint: (SprintRow & { summary: BoardSummary }) | null
}

// ── ทีมงาน (F5.11) ───────────────────────────────────────────────────

export interface TeamMemberRow {
    id: string
    userId: string
    roleInTeam: string
    joinedAt: string
    user: Person & { position: string | null }
}

export interface TeamRow {
    id: string
    name: string
    description: string | null
    leaderId: string | null
    active: boolean
    createdAt: string
    updatedAt: string
    leader: Person | null
    members: TeamMemberRow[]
    _count: { members: number; projects: number; tickets: number }
}

export interface TeamListResponse {
    teams: TeamRow[]
}

// ── ป้ายกำกับ / ตัวช่วยฝั่งหน้าจอ ────────────────────────────────────

/// คอลัมน์ที่ถือว่าปิดงานแล้ว — ใช้ทำเส้นทึบ/จาง บนการ์ด
export function isDoneStatus(status: string): status is BoardStatus {
    return status === "done"
}

/// ช่วงวันของ Sprint — "1 ก.ย. 2569 – 14 ก.ย. 2569"
export function thaiDateRange(from: string, to: string): string {
    return `${formatThaiDate(from)} – ${formatThaiDate(to)}`
}

/// แปลงวันที่จาก API (ISO เต็ม) ให้ใส่ใน <input type="date"> ได้ตามวันไทย
export function toDateInput(iso: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/// เลยกำหนดแล้วหรือยัง — งานที่ปิดแล้วไม่ถือว่าเลยกำหนด
export function isTaskOverdue(task: Pick<TaskCard, "dueDate" | "boardStatus">): boolean {
    if (!task.dueDate || task.boardStatus === "done") return false
    return new Date(task.dueDate).getTime() < Date.now()
}
