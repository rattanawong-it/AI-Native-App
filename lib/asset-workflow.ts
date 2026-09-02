// lib/asset-workflow.ts
// สถานะครุภัณฑ์ + การเปลี่ยนสถานะที่อนุญาต และชนิดของประวัติการเคลื่อนไหว (F7.3, F7.4)
// อ้างอิง docs/spec.md §5.6 (Asset, AssetHistory) และ §8 ⑦A
//
// วงจรปกติของครุภัณฑ์หนึ่งชิ้น:
//   ในคลัง → จ่ายให้ผู้ครอบครอง (ใช้งาน) → คืนคลัง / ส่งซ่อม → จำหน่ายเมื่อหมดอายุการใช้งาน

export const ASSET_STATUSES = ["in_use", "in_stock", "repair", "disposed"] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_HISTORY_ACTIONS = [
    "register",
    "assign",
    "transfer",
    "repair",
    "return",
    "dispose",
] as const
export type AssetHistoryAction = (typeof ASSET_HISTORY_ACTIONS)[number]

/// การกระทำที่เจ้าหน้าที่เลือกเองได้จากหน้าจอ
///
/// `register` ไม่อยู่ในชุดนี้เพราะระบบออกให้เองตอนขึ้นทะเบียนครั้งแรกเท่านั้น —
/// ถ้าปล่อยให้เลือกเองได้ ประวัติจะมี "ขึ้นทะเบียน" โผล่กลางทางซึ่งอ่านแล้วสับสน
export const MANUAL_HISTORY_ACTIONS = [
    "assign",
    "transfer",
    "repair",
    "return",
    "dispose",
] as const
export type ManualHistoryAction = (typeof MANUAL_HISTORY_ACTIONS)[number]

/// ประเภทครุภัณฑ์ที่ใช้บ่อยในศูนย์ไอที — เก็บเป็น string ใน DB จึงเพิ่มได้ภายหลังโดยไม่ต้อง migrate
export const ASSET_TYPES = [
    "computer",
    "notebook",
    "monitor",
    "printer",
    "network",
    "server",
    "peripheral",
    "software",
    "other",
] as const
export type AssetType = (typeof ASSET_TYPES)[number]

/// สถานะปลายทางที่เปลี่ยนไปได้ — key คือสถานะปัจจุบัน (F7.3)
const TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
    in_stock: ["in_use", "repair", "disposed"],
    in_use: ["in_stock", "repair", "disposed"],
    repair: ["in_stock", "in_use", "disposed"],
    // จำหน่ายแล้วถือว่าจบวงจร — เปิดทางกลับไว้เฉพาะกรณีบันทึกผิดแล้วต้องแก้คืน
    disposed: ["in_stock"],
}

/// สถานะที่ครุภัณฑ์ต้องมีผู้ครอบครองเสมอ
const REQUIRES_CUSTODIAN: AssetStatus[] = ["in_use"]

/// การกระทำที่พาไปสู่สถานะใด — ใช้เดาสถานะปลายทางให้อัตโนมัติเมื่อบันทึกประวัติ (F7.4)
const ACTION_RESULT: Record<AssetHistoryAction, AssetStatus | null> = {
    // ขึ้นทะเบียนไม่บังคับสถานะ — ใช้ค่าที่ผู้กรอกเลือกไว้ในฟอร์มตามเดิม
    register: null,
    assign: "in_use",
    transfer: "in_use", // โอนให้คนใหม่ — ยังใช้งานอยู่เหมือนเดิม
    repair: "repair",
    return: "in_stock",
    dispose: "disposed",
}

export function isAssetStatus(value: string): value is AssetStatus {
    return (ASSET_STATUSES as readonly string[]).includes(value)
}

export function isAssetHistoryAction(value: string): value is AssetHistoryAction {
    return (ASSET_HISTORY_ACTIONS as readonly string[]).includes(value)
}

export function isAssetType(value: string): value is AssetType {
    return (ASSET_TYPES as readonly string[]).includes(value)
}

/// เปลี่ยนจาก `from` ไป `to` ได้ไหม (สถานะเดิมซ้ำถือว่าได้ — เช่นโอนผู้ครอบครองโดยยังใช้งานอยู่)
export function canTransition(from: string, to: string): boolean {
    if (!isAssetStatus(from) || !isAssetStatus(to)) return false
    if (from === to) return true
    return TRANSITIONS[from].includes(to)
}

/// สถานะถัดไปที่เลือกได้ — ใช้สร้างเมนูใน UI
export function nextStatuses(from: string): AssetStatus[] {
    return isAssetStatus(from) ? TRANSITIONS[from] : []
}

/// สถานะปลายทางของการกระทำหนึ่งๆ — `null` เมื่อไม่ได้บังคับให้สถานะเปลี่ยน
export function statusAfterAction(action: AssetHistoryAction): AssetStatus | null {
    return ACTION_RESULT[action]
}

export function requiresCustodian(status: string): boolean {
    return isAssetStatus(status) && REQUIRES_CUSTODIAN.includes(status)
}

/// ข้อความอธิบายเมื่อเปลี่ยนสถานะไม่ได้ — คืนข้อความไทยให้ API ตอบผู้ใช้ได้ตรงๆ
export function transitionError(from: string, to: string): string | null {
    if (!isAssetStatus(from)) return `สถานะปัจจุบัน "${from}" ไม่ถูกต้อง`
    if (!isAssetStatus(to)) return `สถานะปลายทาง "${to}" ไม่ถูกต้อง`
    if (!canTransition(from, to)) {
        const allowed = TRANSITIONS[from].map((s) => ASSET_STATUS_LABEL[s]).join(" หรือ ")
        return `เปลี่ยนจาก "${ASSET_STATUS_LABEL[from]}" ไป "${ASSET_STATUS_LABEL[to]}" ไม่ได้ — เปลี่ยนได้เฉพาะ ${allowed}`
    }
    return null
}

// ── ป้ายกำกับภาษาไทย (NFR4 — ใช้ร่วมกันทั้งฝั่ง API และ UI) ──────────

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
    in_use: "ใช้งาน",
    in_stock: "ในคลัง",
    repair: "ส่งซ่อม",
    disposed: "จำหน่ายแล้ว",
}

export const ASSET_HISTORY_ACTION_LABEL: Record<AssetHistoryAction, string> = {
    register: "ขึ้นทะเบียน",
    assign: "จ่ายให้ผู้ครอบครอง",
    transfer: "โอนย้าย",
    repair: "ส่งซ่อม",
    return: "คืนคลัง",
    dispose: "จำหน่าย",
}

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
    computer: "คอมพิวเตอร์ตั้งโต๊ะ",
    notebook: "โน้ตบุ๊ก",
    monitor: "จอภาพ",
    printer: "เครื่องพิมพ์",
    network: "อุปกรณ์เครือข่าย",
    server: "เซิร์ฟเวอร์",
    peripheral: "อุปกรณ์ต่อพ่วง",
    software: "ซอฟต์แวร์/ลิขสิทธิ์",
    other: "อื่นๆ",
}
