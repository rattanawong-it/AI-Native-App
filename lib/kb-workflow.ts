// lib/kb-workflow.ts
// Workflow 4 สถานะของบทความคลังความรู้ + กติกาการเผยแพร่ (F6.4, F6.5)
// อ้างอิง docs/spec.md §5.5 (KbArticle) และ §8 ⑥
//
// สถานะที่อนุญาต:
//   draft → pending_review → published → archived
// พร้อมทางกลับที่ใช้จริงหน้างาน: ตีกลับให้แก้ และถอนบทความที่เผยแพร่แล้ว

export const KB_STATUSES = [
    "draft",
    "pending_review",
    "published",
    "archived",
] as const

export type KbStatus = (typeof KB_STATUSES)[number]

export const KB_VISIBILITIES = ["all", "agent_only"] as const
export type KbVisibility = (typeof KB_VISIBILITIES)[number]

/// ตารางการเปลี่ยนสถานะที่ถูกต้อง — key คือสถานะปัจจุบัน (F6.4)
const TRANSITIONS: Record<KbStatus, KbStatus[]> = {
    draft: ["pending_review", "archived"],
    pending_review: ["published", "draft"], // ตีกลับให้ผู้เขียนแก้ได้
    published: ["archived", "draft"], // ถอนบทความกลับไปแก้ หรือเก็บเข้ากรุ
    archived: ["draft"], // กู้บทความเก่ากลับมาแก้ใหม่ได้
}

/// สถานะที่ต้องใช้สิทธิ์ `manager` ขึ้นไปเท่านั้น (F6.5)
const MANAGER_ONLY: KbStatus[] = ["published"]

export function isKbStatus(value: string): value is KbStatus {
    return (KB_STATUSES as readonly string[]).includes(value)
}

export function isKbVisibility(value: string): value is KbVisibility {
    return (KB_VISIBILITIES as readonly string[]).includes(value)
}

/// เปลี่ยนจาก `from` ไป `to` ได้ไหม
export function canTransition(from: string, to: string): boolean {
    if (!isKbStatus(from) || !isKbStatus(to)) return false
    return TRANSITIONS[from].includes(to)
}

/// สถานะถัดไปที่เลือกได้ — ใช้สร้างเมนูใน UI (กรองตามสิทธิ์ผู้ใช้)
export function nextStatuses(from: string, canPublish: boolean): KbStatus[] {
    if (!isKbStatus(from)) return []
    return TRANSITIONS[from].filter((s) => canPublish || !MANAGER_ONLY.includes(s))
}

/// ต้องเป็น manager ขึ้นไปไหมถึงจะเปลี่ยนไปสถานะนี้ได้ (F6.5)
export function requiresPublishRight(to: string): boolean {
    return isKbStatus(to) && MANAGER_ONLY.includes(to)
}

/// ข้อความอธิบายเมื่อเปลี่ยนสถานะไม่ได้ (คืนข้อความไทยให้ API ตอบตรงๆ)
export function transitionError(from: string, to: string): string | null {
    if (!isKbStatus(from)) return `สถานะปัจจุบัน "${from}" ไม่ถูกต้อง`
    if (!isKbStatus(to)) return `สถานะปลายทาง "${to}" ไม่ถูกต้อง`
    if (from === to) return `บทความอยู่ในสถานะ "${KB_STATUS_LABEL[to]}" อยู่แล้ว`
    if (!canTransition(from, to)) {
        const allowed = TRANSITIONS[from].map((s) => KB_STATUS_LABEL[s]).join(" หรือ ")
        return `เปลี่ยนจาก "${KB_STATUS_LABEL[from]}" ไป "${KB_STATUS_LABEL[to]}" ไม่ได้ — เปลี่ยนได้เฉพาะ ${allowed}`
    }
    return null
}

// ── ป้ายกำกับภาษาไทย (ใช้ทั้งฝั่ง API และ UI) ────────────────────────

export const KB_STATUS_LABEL: Record<KbStatus, string> = {
    draft: "ฉบับร่าง",
    pending_review: "รอตรวจทาน",
    published: "เผยแพร่แล้ว",
    archived: "เก็บเข้ากรุ",
}

export const KB_VISIBILITY_LABEL: Record<KbVisibility, string> = {
    all: "ทุกคน",
    agent_only: "เฉพาะเจ้าหน้าที่",
}

// ── Slug ─────────────────────────────────────────────────────────────

/// สร้าง slug จากหัวข้อ — คงอักษรไทยไว้ (URL รองรับ UTF-8) ตัดอักขระที่ใช้ใน path ไม่ได้ออก
/// ถ้าหัวข้อเป็นอักขระพิเศษล้วนจนได้ slug ว่าง จะคืน "article" ให้ผู้เรียกไปต่อท้ายเลขเอง
export function slugifyTitle(title: string): string {
    const slug = title
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^\p{Letter}\p{Number}-]/gu, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80)

    return slug || "article"
}
