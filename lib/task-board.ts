// lib/task-board.ts
// นิยามกลางของกระดาน Kanban, สถานะโครงการ และสถานะ Sprint (F5.3, F5.4, F5.5)
// อ้างอิง docs/spec.md §5.4 และ §8 ⑤
//
// วางไว้เป็นไฟล์ค่าคงที่ล้วน (ไม่มี import ฝั่ง server) เพื่อให้ทั้ง API route,
// zod schema และ client component เรียกใช้ชุดเดียวกันได้ — เหมือน lib/ticket-workflow.ts

// ── คอลัมน์บนกระดาน (F5.4) ───────────────────────────────────────────

/// เรียงจากซ้ายไปขวาตามลำดับการทำงานจริง — ลำดับใน array คือลำดับคอลัมน์บนหน้าจอ
export const BOARD_STATUSES = ["backlog", "todo", "doing", "review", "done"] as const
export type BoardStatus = (typeof BOARD_STATUSES)[number]

export function isBoardStatus(value: string): value is BoardStatus {
    return (BOARD_STATUSES as readonly string[]).includes(value)
}

export const BOARD_STATUS_LABEL: Record<BoardStatus, string> = {
    backlog: "รอจัดคิว",
    todo: "รอเริ่ม",
    doing: "กำลังทำ",
    review: "รอตรวจ",
    done: "เสร็จแล้ว",
}

/// คำอธิบายใต้หัวคอลัมน์ — ช่วยให้ทีมเข้าใจตรงกันว่าการ์ดควรอยู่คอลัมน์ไหน
export const BOARD_STATUS_HINT: Record<BoardStatus, string> = {
    backlog: "งานที่รับไว้แล้วแต่ยังไม่จัดเข้ารอบ",
    todo: "จัดเข้ารอบแล้ว รอลงมือ",
    doing: "กำลังพัฒนาอยู่",
    review: "รอตรวจรับ / ทดสอบ",
    done: "ตรวจรับแล้ว ปิดงาน",
}

/// ใช้ token สีเดียวกับสถานะ Ticket เพื่อให้ทั้งระบบอ่านสีแล้วเข้าใจตรงกัน
export const BOARD_STATUS_BADGE_CLASS: Record<BoardStatus, string> = {
    backlog: "bg-status-closed-bg text-status-closed-fg",
    todo: "bg-status-new-bg text-status-new-fg",
    doing: "bg-status-progress-bg text-status-progress-fg",
    review: "bg-status-assigned-bg text-status-assigned-fg",
    done: "bg-status-resolved-bg text-status-resolved-fg",
}

/// สีจุดนำหน้าหัวคอลัมน์ (เขียนเต็มคลาสเพื่อให้ Tailwind JIT มองเห็น)
export const BOARD_STATUS_DOT: Record<BoardStatus, string> = {
    backlog: "bg-status-closed",
    todo: "bg-status-new",
    doing: "bg-status-progress",
    review: "bg-status-assigned",
    done: "bg-status-resolved",
}

/// สถานะที่ถือว่างานยังไม่จบ — ใช้กรอง My Work และนับภาระงาน
export const OPEN_BOARD_STATUSES: BoardStatus[] = ["backlog", "todo", "doing", "review"]

// ── สถานะโครงการ (F5.1) ──────────────────────────────────────────────

export const PROJECT_STATUSES = [
    "planning",
    "active",
    "on_hold",
    "completed",
    "cancelled",
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
    planning: "วางแผน",
    active: "กำลังดำเนินการ",
    on_hold: "พักไว้ชั่วคราว",
    completed: "เสร็จสิ้น",
    cancelled: "ยกเลิก",
}

export const PROJECT_STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
    planning: "bg-status-assigned-bg text-status-assigned-fg",
    active: "bg-status-progress-bg text-status-progress-fg",
    on_hold: "bg-priority-low-bg text-priority-low-fg",
    completed: "bg-status-resolved-bg text-status-resolved-fg",
    cancelled: "bg-status-closed-bg text-status-closed-fg",
}

/// โครงการที่ยังต้องติดตาม — ใช้เป็นค่าเริ่มต้นของตัวกรองในหน้ารายการ
export const OPEN_PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold"]

// ── สถานะ Sprint (F5.3) ──────────────────────────────────────────────

export const SPRINT_STATUSES = ["planned", "active", "completed"] as const
export type SprintStatus = (typeof SPRINT_STATUSES)[number]

export const SPRINT_STATUS_LABEL: Record<SprintStatus, string> = {
    planned: "รอเริ่ม",
    active: "กำลังดำเนินการ",
    completed: "ปิดรอบแล้ว",
}

export const SPRINT_STATUS_BADGE_CLASS: Record<SprintStatus, string> = {
    planned: "bg-status-new-bg text-status-new-fg",
    active: "bg-status-progress-bg text-status-progress-fg",
    completed: "bg-status-resolved-bg text-status-resolved-fg",
}

// ── บทบาทในทีม (F5.11) ───────────────────────────────────────────────

export const TEAM_ROLES = ["leader", "member"] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
    leader: "หัวหน้าทีม",
    member: "สมาชิก",
}

// ── ตัวช่วยคำนวณ ─────────────────────────────────────────────────────

/// ความคืบหน้าโครงการ = สัดส่วน Task ที่อยู่คอลัมน์ done (F5.10)
///
/// ไม่มี Task เลยถือว่า 0% — ไม่ใช่ 100% เพราะโครงการที่ยังไม่มีงานย่อยคือโครงการที่ยังไม่เริ่ม
export function progressFrom(doneCount: number, totalCount: number): number {
    if (totalCount <= 0) return 0
    return Math.round((doneCount / totalCount) * 100)
}

/// ระยะห่างของ `sortOrder` ระหว่างการ์ด — เว้นช่องไว้ให้แทรกการ์ดกลางคอลัมน์ได้
/// โดยไม่ต้องเขียนทับทั้งคอลัมน์ทุกครั้งที่ลาก
export const SORT_STEP = 1000
