// lib/priority.ts
// Impact × Urgency Matrix (ITIL) — คำนวณ Priority อัตโนมัติ
// อ้างอิง docs/spec.md §5.2 (Priority Matrix) และ F2.1

export const IMPACT_LEVELS = ["high", "medium", "low"] as const
export const URGENCY_LEVELS = ["high", "medium", "low"] as const
export const PRIORITY_LEVELS = ["critical", "high", "medium", "low"] as const

export type Impact = (typeof IMPACT_LEVELS)[number]
export type Urgency = (typeof URGENCY_LEVELS)[number]
export type Priority = (typeof PRIORITY_LEVELS)[number]

/// ตาราง 3×3 ตาม spec §5.2
///
///              | Urgency สูง | Urgency กลาง | Urgency ต่ำ
///  Impact สูง  |  Critical   |    High      |   Medium
///  Impact กลาง |    High     |   Medium     |    Low
///  Impact ต่ำ  |   Medium    |    Low       |    Low
const MATRIX: Record<Impact, Record<Urgency, Priority>> = {
    high: { high: "critical", medium: "high", low: "medium" },
    medium: { high: "high", medium: "medium", low: "low" },
    low: { high: "medium", medium: "low", low: "low" },
}

/// คำนวณ Priority จาก Impact × Urgency — ค่าที่ไม่รู้จักจะถูกปรับเป็น "medium"
export function calculatePriority(impact: string, urgency: string): Priority {
    const i = (IMPACT_LEVELS as readonly string[]).includes(impact) ? (impact as Impact) : "medium"
    const u = (URGENCY_LEVELS as readonly string[]).includes(urgency) ? (urgency as Urgency) : "medium"
    return MATRIX[i][u]
}

/// น้ำหนักสำหรับเรียงคิวงาน — มากกว่า = ควรทำก่อน (F2.5)
export const PRIORITY_WEIGHT: Record<Priority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
}

/// เรียงลำดับคิวงาน: Priority มากก่อน → ครบกำหนดเร็วกว่าก่อน (F2.5)
export function compareByQueueOrder(
    a: { priority: string; resolutionDueAt?: Date | string | null },
    b: { priority: string; resolutionDueAt?: Date | string | null }
): number {
    const wa = PRIORITY_WEIGHT[a.priority as Priority] ?? 0
    const wb = PRIORITY_WEIGHT[b.priority as Priority] ?? 0
    if (wa !== wb) return wb - wa

    const da = a.resolutionDueAt ? new Date(a.resolutionDueAt).getTime() : Number.MAX_SAFE_INTEGER
    const db = b.resolutionDueAt ? new Date(b.resolutionDueAt).getTime() : Number.MAX_SAFE_INTEGER
    return da - db
}

// ── ป้ายกำกับภาษาไทย + สีตาม design system (F2.3) ────────────────────

export const IMPACT_LABEL: Record<Impact, string> = {
    high: "สูง",
    medium: "กลาง",
    low: "ต่ำ",
}

export const URGENCY_LABEL: Record<Urgency, string> = {
    high: "สูง",
    medium: "กลาง",
    low: "ต่ำ",
}

export const PRIORITY_LABEL: Record<Priority, string> = {
    critical: "วิกฤต",
    high: "สูง",
    medium: "ปานกลาง",
    low: "ต่ำ",
}

/// คลาส Tailwind ของ Priority Badge — ใช้ token ใน app/globals.css
export const PRIORITY_BADGE_CLASS: Record<Priority, string> = {
    critical: "bg-priority-critical-bg text-priority-critical-fg",
    high: "bg-priority-high-bg text-priority-high-fg",
    medium: "bg-priority-medium-bg text-priority-medium-fg",
    low: "bg-priority-low-bg text-priority-low-fg",
}
