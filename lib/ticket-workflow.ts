// lib/ticket-workflow.ts
// Workflow 5 สถานะของ Ticket + กติกาการเปลี่ยนสถานะ (F2.6)
// อ้างอิง docs/spec.md §5.2 (status) และ §8 ②
//
// สถานะที่อนุญาต:
//   new → assigned → in_progress → resolved → closed
// พร้อมทางลัดที่ใช้จริงหน้างาน: เปิดงานซ้ำจาก resolved กลับไป in_progress

export const TICKET_STATUSES = [
    "new",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_CHANNELS = ["web", "line", "email", "phone", "walkin"] as const
export type TicketChannel = (typeof TICKET_CHANNELS)[number]

/// ตารางการเปลี่ยนสถานะที่ถูกต้อง — key คือสถานะปัจจุบัน (F2.6)
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    new: ["assigned"],
    assigned: ["in_progress", "new"], // ถอนการมอบหมายกลับเป็น new ได้
    in_progress: ["resolved", "assigned"], // ส่งคืนคิวได้ถ้าทำต่อไม่ได้
    resolved: ["closed", "in_progress"], // ผู้แจ้ง/เจ้าหน้าที่เปิดงานซ้ำได้
    closed: [], // สถานะปลายทาง — ปิดแล้วจบ
}

export function isTicketStatus(value: string): value is TicketStatus {
    return (TICKET_STATUSES as readonly string[]).includes(value)
}

/// เปลี่ยนจาก `from` ไป `to` ได้ไหม
export function canTransition(from: string, to: string): boolean {
    if (!isTicketStatus(from) || !isTicketStatus(to)) return false
    return TRANSITIONS[from].includes(to)
}

/// สถานะถัดไปที่เลือกได้จากสถานะปัจจุบัน — ใช้สร้างเมนูใน UI
export function nextStatuses(from: string): TicketStatus[] {
    return isTicketStatus(from) ? TRANSITIONS[from] : []
}

/// ข้อความอธิบายเมื่อเปลี่ยนสถานะไม่ได้ (คืนข้อความไทยให้ API ตอบตรงๆ)
export function transitionError(from: string, to: string): string | null {
    if (!isTicketStatus(from)) return `สถานะปัจจุบัน "${from}" ไม่ถูกต้อง`
    if (!isTicketStatus(to)) return `สถานะปลายทาง "${to}" ไม่ถูกต้อง`
    if (from === to) return `Ticket อยู่ในสถานะ "${TICKET_STATUS_LABEL[to]}" อยู่แล้ว`
    if (from === "closed") return "Ticket ปิดงานแล้ว ไม่สามารถเปลี่ยนสถานะได้"
    if (!canTransition(from, to)) {
        const allowed = TRANSITIONS[from].map((s) => TICKET_STATUS_LABEL[s]).join(" หรือ ")
        return `เปลี่ยนจาก "${TICKET_STATUS_LABEL[from]}" ไป "${TICKET_STATUS_LABEL[to]}" ไม่ได้ — เปลี่ยนได้เฉพาะ ${allowed}`
    }
    return null
}

/// สถานะที่ถือว่า "ยังไม่จบงาน" — ใช้กรองคิวงานและ My Work
export const OPEN_STATUSES: TicketStatus[] = ["new", "assigned", "in_progress"]

// ── ป้ายกำกับภาษาไทย + สีตาม design token ใน app/globals.css ─────────

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
    new: "แจ้งใหม่",
    assigned: "มอบหมายแล้ว",
    in_progress: "กำลังดำเนินการ",
    resolved: "แก้ไขแล้ว",
    closed: "ปิดงาน",
}

export const TICKET_STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
    new: "bg-status-new-bg text-status-new-fg",
    assigned: "bg-status-assigned-bg text-status-assigned-fg",
    in_progress: "bg-status-progress-bg text-status-progress-fg",
    resolved: "bg-status-resolved-bg text-status-resolved-fg",
    closed: "bg-status-closed-bg text-status-closed-fg",
}

export const TICKET_CHANNEL_LABEL: Record<TicketChannel, string> = {
    web: "เว็บไซต์",
    line: "LINE",
    email: "อีเมล",
    phone: "โทรศัพท์",
    walkin: "ติดต่อด้วยตนเอง",
}

// ── ชนิดของ activity ที่บันทึกลง TicketActivity (audit log) ───────────

export const TICKET_ACTIONS = [
    "created",
    "assigned",
    "status_changed",
    "priority_changed",
    "commented",
    "resolved",
    "closed",
    "reopened",
] as const

export type TicketAction = (typeof TICKET_ACTIONS)[number]

export const TICKET_ACTION_LABEL: Record<TicketAction, string> = {
    created: "แจ้งปัญหา",
    assigned: "มอบหมายงาน",
    status_changed: "เปลี่ยนสถานะ",
    priority_changed: "ปรับระดับความสำคัญ",
    commented: "แสดงความคิดเห็น",
    resolved: "แก้ไขเสร็จสิ้น",
    closed: "ปิดงาน",
    reopened: "เปิดงานอีกครั้ง",
}
