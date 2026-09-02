// lib/approval-workflow.ts
// Workflow คำขออนุมัติ / เบิกจ่าย — สถานะเอกสาร + ขั้นการอนุมัติหลายชั้น (F7.9, F7.10, F7.11)
// อ้างอิง docs/spec.md §5.6 (ApprovalRequest, ApprovalStep) และ §8 ⑦B
//
// วงจรของคำขอหนึ่งใบ:
//   ฉบับร่าง → ยื่น → ไล่อนุมัติทีละขั้นตาม stepOrder → อนุมัติครบทุกขั้น = อนุมัติแล้ว
//   ขั้นใดขั้นหนึ่งไม่อนุมัติ = ตกทั้งใบทันที (ไม่ไล่ขั้นต่อไป)

export const APPROVAL_STATUSES = [
    "draft",
    "pending",
    "approved",
    "rejected",
    "cancelled",
] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

/// สถานะของ "ขั้น" การอนุมัติ (คนละชุดกับสถานะของใบคำขอ)
export const APPROVAL_STEP_STATUSES = ["pending", "approved", "rejected"] as const
export type ApprovalStepStatus = (typeof APPROVAL_STEP_STATUSES)[number]

export const APPROVAL_TYPES = ["purchase", "supply", "budget", "other"] as const
export type ApprovalType = (typeof APPROVAL_TYPES)[number]

/// สถานะปลายทางที่เปลี่ยนไปได้ — key คือสถานะปัจจุบัน (F7.11)
const TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
    draft: ["pending", "cancelled"],
    pending: ["approved", "rejected", "cancelled"],
    approved: [], // อนุมัติแล้วถือว่าจบ
    rejected: ["draft"], // ตีกลับมาแก้แล้วยื่นใหม่ได้
    cancelled: ["draft"],
}

/// สถานะที่ยังแก้ไขเนื้อหาคำขอได้ — ยื่นแล้วห้ามแก้ เพราะผู้อนุมัติเห็นข้อมูลคนละชุดกับที่ตัดสิน
const EDITABLE: ApprovalStatus[] = ["draft", "rejected", "cancelled"]

/// สถานะที่ถือว่าจบกระบวนการแล้ว
const CLOSED: ApprovalStatus[] = ["approved", "rejected", "cancelled"]

export function isApprovalStatus(value: string): value is ApprovalStatus {
    return (APPROVAL_STATUSES as readonly string[]).includes(value)
}

export function isApprovalType(value: string): value is ApprovalType {
    return (APPROVAL_TYPES as readonly string[]).includes(value)
}

export function canTransition(from: string, to: string): boolean {
    if (!isApprovalStatus(from) || !isApprovalStatus(to)) return false
    return TRANSITIONS[from].includes(to)
}

export function isEditable(status: string): boolean {
    return isApprovalStatus(status) && EDITABLE.includes(status)
}

export function isClosed(status: string): boolean {
    return isApprovalStatus(status) && CLOSED.includes(status)
}

/// ข้อความอธิบายเมื่อเปลี่ยนสถานะไม่ได้
export function transitionError(from: string, to: string): string | null {
    if (!isApprovalStatus(from)) return `สถานะปัจจุบัน "${from}" ไม่ถูกต้อง`
    if (!isApprovalStatus(to)) return `สถานะปลายทาง "${to}" ไม่ถูกต้อง`
    if (from === to) return `คำขออยู่ในสถานะ "${APPROVAL_STATUS_LABEL[to]}" อยู่แล้ว`
    if (!canTransition(from, to)) {
        const allowed = TRANSITIONS[from]
        const detail =
            allowed.length === 0
                ? "คำขอนี้จบกระบวนการแล้ว เปลี่ยนสถานะไม่ได้"
                : `เปลี่ยนได้เฉพาะ ${allowed.map((s) => APPROVAL_STATUS_LABEL[s]).join(" หรือ ")}`
        return `เปลี่ยนจาก "${APPROVAL_STATUS_LABEL[from]}" ไป "${APPROVAL_STATUS_LABEL[to]}" ไม่ได้ — ${detail}`
    }
    return null
}

// ── การไล่ขั้นอนุมัติ (F7.10) ─────────────────────────────────────────

/// ขั้นการอนุมัติแบบย่อที่ตรรกะด้านล่างต้องใช้
export interface StepLike {
    stepOrder: number
    approverId: string
    status: string
}

/// ผลลัพธ์หลังผู้อนุมัติขั้นปัจจุบันตัดสินใจ — บอกว่าใบคำขอต้องไปสถานะใดและขั้นถัดไปคือขั้นไหน
export interface DecisionOutcome {
    /// สถานะใหม่ของใบคำขอ
    status: ApprovalStatus
    /// ขั้นที่รอการตัดสินใจถัดไป — เท่ากับขั้นเดิมเมื่อจบแล้ว
    currentStep: number
    /// ผู้อนุมัติคนถัดไปที่ต้องแจ้งเตือน — `null` เมื่อไม่มีขั้นต่อไปแล้ว
    nextApproverId: string | null
}

/// คำนวณผลหลังขั้น `decidedStep` ถูกตัดสิน
///
/// ไม่อนุมัติ = ตกทั้งใบทันที · อนุมัติแล้วยังมีขั้นถัดไป = เดินหน้าไปขั้นนั้น · หมดขั้น = อนุมัติแล้ว
export function resolveDecision(
    steps: StepLike[],
    decidedStep: number,
    approved: boolean
): DecisionOutcome {
    if (!approved) {
        return { status: "rejected", currentStep: decidedStep, nextApproverId: null }
    }

    const next = steps
        .filter((s) => s.stepOrder > decidedStep)
        .sort((a, b) => a.stepOrder - b.stepOrder)[0]

    if (!next) {
        return { status: "approved", currentStep: decidedStep, nextApproverId: null }
    }

    return { status: "pending", currentStep: next.stepOrder, nextApproverId: next.approverId }
}

/// ผู้ใช้คนนี้เป็นผู้อนุมัติของขั้นที่กำลังรออยู่ไหม (F7.12)
export function isCurrentApprover(
    userId: string,
    request: { status: string; currentStep: number },
    steps: StepLike[]
): boolean {
    if (request.status !== "pending") return false
    return steps.some(
        (s) =>
            s.stepOrder === request.currentStep &&
            s.status === "pending" &&
            s.approverId === userId
    )
}

// ── ป้ายกำกับภาษาไทย (NFR4) ──────────────────────────────────────────

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
    draft: "ฉบับร่าง",
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ",
    cancelled: "ยกเลิก",
}

export const APPROVAL_STEP_STATUS_LABEL: Record<ApprovalStepStatus, string> = {
    pending: "รอพิจารณา",
    approved: "อนุมัติ",
    rejected: "ไม่อนุมัติ",
}

export const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
    purchase: "จัดซื้อ",
    supply: "เบิกวัสดุ",
    budget: "งบประมาณ",
    other: "อื่นๆ",
}
