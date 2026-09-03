// lib/dashboard-types.ts
// รูปร่างข้อมูลของแดชบอร์ดที่ฝั่ง server เตรียมแล้วส่งเป็น props ให้ client component
// อ้างอิง docs/spec.md §8 ⑨ (F9.1–F9.5) และ F3.9
//
// ค่าวันที่เป็น string ทั้งหมด เพราะต้องข้ามเส้นแบ่ง server → client component

import type { CountGroup, TrendPoint } from "@/lib/report-types"
import type { WorkItem } from "@/lib/worklog-service"

/// ชั้นการแสดงผลของแดชบอร์ด — ไล่จากน้อยไปมาก แต่ละชั้นรวมของชั้นก่อนหน้าไว้ด้วย (F9.1)
///   requester = student / user · agent = เจ้าหน้าที่ · manager = หัวหน้าและผู้ดูแลระบบ
export type DashboardView = "requester" | "agent" | "manager"

/// Ticket แบบย่อสำหรับรายการบนแดชบอร์ด
export interface DashboardTicketBrief {
    id: string
    ticketNo: string
    title: string
    status: string
    priority: string
    resolutionDueAt: string | null
    /// ชื่อหมวดหมู่ หรือชื่อผู้แจ้ง แล้วแต่บริบทของรายการนั้น
    context: string | null
}

/// ① Ticket ที่ผู้ใช้เป็นคนแจ้งเอง — ทุก role เห็นส่วนนี้ (F9.2)
export interface MineSection {
    open: number
    /// แก้ไขแล้วแต่ยังไม่ปิดงาน — รอผู้แจ้งยืนยัน
    waitingConfirm: number
    total: number
    recent: DashboardTicketBrief[]
}

/// ② งานที่ต้องทำของเจ้าหน้าที่ (F9.3, F3.9)
export interface WorkSection {
    openNow: number
    dueToday: number
    overdue: number
    /// ครบกำหนดแก้ไขภายใน 24 ชั่วโมงข้างหน้า และยังไม่ได้แก้
    atRisk: number
    hoursThisWeek: number
    /// คิวงานเรียงตามความเร่ง — ความสำคัญสูงก่อน ครบกำหนดเร็วกว่าก่อน
    queue: DashboardTicketBrief[]
    dueTodayItems: WorkItem[]
    overdueItems: WorkItem[]
}

/// ③ ภาพรวมทั้งศูนย์ของหัวหน้า (F9.4, F9.5)
export interface CenterSection {
    created: number
    resolved: number
    pending: number
    slaRate: number | null
    /// ใบที่ยังไม่จบและเลยกำหนดไปแล้ว — ต้องตามด่วน
    breachedOpen: number
    /// ใบที่แจ้งเข้ามาแล้วยังไม่มีคนรับ
    unassigned: number
    pendingApprovals: number
    trend: TrendPoint[]
    byStatus: CountGroup[]
    topWorkload: { userId: string; name: string; openNow: number; hours: number }[]
    projects: {
        id: string
        code: string
        name: string
        progress: number
        doneTasks: number
        totalTasks: number
        overdueTasks: number
    }[]
}

export interface DashboardData {
    view: DashboardView
    userName: string
    /// ช่วงย้อนหลังของ KPI และกราฟ — 7 หรือ 30 วัน (F9.5)
    rangeDays: number
    generatedAt: string
    mine: MineSection
    work: WorkSection | null
    center: CenterSection | null
}
