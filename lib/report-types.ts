// lib/report-types.ts
// รูปร่างข้อมูลของรายงานประจำเดือน / ไตรมาส ที่ API คืนให้ client
// ใช้ร่วมกันทั้งฝั่ง API, หน้ารายงาน และตัวส่งออก Excel
// อ้างอิง docs/spec.md §8 ⑦C (F7.15–F7.23) และ ⑨ (F9.5)
//
// ค่าวันที่ทุกตัวเป็น string รูปแบบ ISO เพราะผ่าน JSON มาแล้ว

// ── ช่วงเวลาของรายงาน (F7.15) ────────────────────────────────────────

export const PERIOD_TYPES = ["month", "quarter", "custom"] as const
export type PeriodType = (typeof PERIOD_TYPES)[number]

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
    month: "รายเดือน",
    quarter: "รายไตรมาส",
    custom: "กำหนดเอง",
}

/// ช่วงเวลาที่ผ่านการตีความแล้ว — `from`/`to` เป็นวันตามปฏิทินไทย "YYYY-MM-DD"
export interface ReportPeriod {
    type: PeriodType
    from: string
    to: string
    /// ป้ายที่แสดงบนหัวรายงาน เช่น "กันยายน 2569" หรือ "ไตรมาส 4/2569"
    label: string
}

// ── ตัวเลขเทียบกับช่วงก่อนหน้า ───────────────────────────────────────

/// ค่าหนึ่งตัวพร้อมค่าของช่วงก่อนหน้า — `delta` เป็นผลต่างดิบ (null = ไม่มีข้อมูลเทียบ)
export interface Metric {
    value: number
    previous: number | null
    delta: number | null
    /// % การเปลี่ยนแปลง (null เมื่อช่วงก่อนหน้าเป็น 0 หรือไม่มีข้อมูล)
    percent: number | null
}

/// แถวสรุปแบบจัดกลุ่มที่ใช้ซ้ำในหลายรายงาน
export interface CountGroup {
    key: string
    label: string
    count: number
}

// ── ① สรุป Ticket (F7.16) ────────────────────────────────────────────

export interface TicketSection {
    created: Metric
    resolved: Metric
    closed: Metric
    /// ค้างอยู่ ณ วันสิ้นสุดช่วง (ยังไม่ resolved/closed)
    pending: Metric
    /// เวลาเฉลี่ยที่ใช้แก้ไข (ชั่วโมง) — null เมื่อไม่มีใบที่แก้เสร็จในช่วง
    avgResolutionHours: number | null
    byCategory: CountGroup[]
    byPriority: CountGroup[]
    byChannel: CountGroup[]
    byStatus: CountGroup[]
}

// ── ② SLA Compliance (F7.17) ─────────────────────────────────────────

export interface SlaSection {
    /// % ตอบกลับตรงเวลา (null = ยังไม่มีใบที่รู้ผล)
    responseRate: number | null
    resolutionRate: number | null
    responseMeasured: number
    responseMet: number
    resolutionMeasured: number
    resolutionMet: number
    breached: number
    /// % แก้ไขตรงเวลาของช่วงก่อนหน้า ใช้เทียบแนวโน้ม
    previousResolutionRate: number | null
}

// ── ③ ภาระงานเจ้าหน้าที่ (F7.18) ─────────────────────────────────────

export interface WorkloadRow {
    userId: string
    name: string
    /// Ticket ที่ได้รับมอบหมายและแจ้งเข้ามาในช่วงนี้
    assigned: number
    resolved: number
    /// ค้างอยู่ในมือ ณ ตอนนี้ (ไม่ผูกกับช่วงเวลา)
    openNow: number
    /// ชั่วโมงจาก Time Log ในช่วงที่เลือก
    hours: number
}

export interface WorkloadSection {
    rows: WorkloadRow[]
    totalHours: number
}

// ── ④ ความคืบหน้าโครงการ SDLC (F7.19) ────────────────────────────────

export interface ProjectProgressRow {
    id: string
    code: string
    name: string
    status: string
    progress: number
    totalTasks: number
    doneTasks: number
    /// Task ที่เลยกำหนดและยังไม่ done
    overdueTasks: number
    /// ชั่วโมงที่ลงกับโครงการนี้ในช่วงที่เลือก
    hours: number
    endDate: string | null
}

export interface ProjectSection {
    rows: ProjectProgressRow[]
    byStatus: CountGroup[]
    /// Task ที่ปิดได้ในช่วงที่เลือก
    tasksDone: Metric
}

// ── ⑤ ครุภัณฑ์ + คำขออนุมัติ (F7.20) ─────────────────────────────────

export interface AssetSection {
    total: number
    byStatus: CountGroup[]
    byType: CountGroup[]
    /// ครุภัณฑ์ที่ซื้อเข้ามาในช่วงที่เลือก
    purchased: Metric
    /// มูลค่ารวมของที่ซื้อในช่วงที่เลือก (บาท)
    purchasedValue: number
    /// ใกล้หมดประกันภายใน 90 วันนับจากวันสิ้นสุดช่วง
    warrantyExpiring: number
}

export interface ApprovalSection {
    created: Metric
    approved: Metric
    rejected: Metric
    pending: number
    byType: CountGroup[]
    /// มูลค่ารวมของคำขอที่อนุมัติแล้วในช่วงที่เลือก (บาท)
    approvedAmount: number
}

// ── ⑥ แนวโน้ม (F7.21, F9.5) ──────────────────────────────────────────

export type TrendGranularity = "day" | "month"

export interface TrendPoint {
    /// คีย์เรียงลำดับได้ — "2026-09-01" (รายวัน) หรือ "2026-09" (รายเดือน)
    key: string
    label: string
    created: number
    resolved: number
    /// % แก้ไขตรงเวลาของช่วงย่อยนั้น (null = ยังไม่มีใบที่รู้ผล)
    slaRate: number | null
}

// ── รายงานทั้งฉบับ ───────────────────────────────────────────────────

export interface SummaryReport {
    period: ReportPeriod
    previousPeriod: ReportPeriod | null
    /// "own" = เห็นเฉพาะงานของตัวเอง (agent) · "all" = ทั้งศูนย์ (manager ขึ้นไป)
    scope: "own" | "all"
    generatedAt: string
    /// จริงเมื่อข้อมูลถูกตัดที่เพดานแถว — ตัวเลขในรายงานจะไม่ครบ
    truncated: boolean
    tickets: TicketSection
    sla: SlaSection
    workload: WorkloadSection
    projects: ProjectSection
    assets: AssetSection
    approvals: ApprovalSection
    trend: { granularity: TrendGranularity; points: TrendPoint[] }
}

// ── Snapshot (F7.23) ─────────────────────────────────────────────────

export interface SnapshotRow {
    id: string
    type: PeriodType
    periodStart: string
    periodEnd: string
    label: string
    generatedBy: string
    generatedByName: string | null
    createdAt: string
    /// ตัวเลขหลักที่ดึงขึ้นมาโชว์ในตารางเปรียบเทียบโดยไม่ต้องเปิดรายงานเต็ม
    highlights: SnapshotHighlights
}

export interface SnapshotHighlights {
    ticketsCreated: number
    ticketsResolved: number
    ticketsPending: number
    slaResolutionRate: number | null
    totalHours: number
    approvalsApproved: number
}

export interface SnapshotListResponse {
    snapshots: SnapshotRow[]
}
