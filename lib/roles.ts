// lib/roles.ts
// นิยาม role และตรรกะเทียบสิทธิ์ล้วนๆ — **ห้าม import อะไรจาก next/** ในไฟล์นี้
//
// เหตุผลที่ต้องแยกออกจาก lib/rbac.ts:
// rbac.ts import `next/server` และ `next/headers` ที่ระดับ module จึงถูก client component
// import ไม่ได้ ผลคือคอมโพเนนต์ฝั่ง client ต้องคัดลอก array `["agent","manager","admin"]`
// ไปเขียนเองราว 19 จุด แล้วเพี้ยนจาก matrix ใน docs/spec.md §7.1 ไปทีละจุด
//
// ไฟล์นี้จึงเป็น **แหล่งความจริงเดียว** ของชื่อ role และลำดับชั้น ใช้ร่วมกันทั้งสองฝั่ง
//   - ฝั่ง server เรียกผ่าน lib/rbac.ts (re-export ทุกตัวไว้แล้ว ไม่ต้องแก้ route เดิม)
//   - ฝั่ง client import จากไฟล์นี้ตรงๆ

/// 5 roles ของระบบ เรียงจากสิทธิ์น้อย → มาก (docs/spec.md §7.1)
export const ROLES = ["student", "user", "agent", "manager", "admin"] as const
export type Role = (typeof ROLES)[number]

/// ลำดับชั้นของ role — ใช้เทียบว่า "อย่างน้อยระดับนี้ขึ้นไป"
export const ROLE_RANK: Record<Role, number> = {
    student: 0,
    user: 1,
    agent: 2,
    manager: 3,
    admin: 4,
}

/// ชื่อภาษาไทยของแต่ละ role — ใช้ในหน้าจัดการผู้ใช้และตั้งค่าระบบ
export const ROLE_LABELS: Record<Role, string> = {
    student: "นักศึกษา",
    user: "บุคลากรทั่วไป",
    agent: "เจ้าหน้าที่ IT",
    manager: "หัวหน้า / ผู้บริหาร",
    admin: "ผู้ดูแลระบบ",
}

/// กลุ่ม role ที่ใช้ซ้ำทั้งระบบ — แทนการเขียน array ซ้ำในแต่ละไฟล์
/// สร้างจาก ROLE_RANK เพื่อให้เพิ่ม role ใหม่แล้วกลุ่มเหล่านี้ขยับตามเอง
export const rolesAtLeast = (min: Role): Role[] =>
    ROLES.filter((r) => ROLE_RANK[r] >= ROLE_RANK[min])

/// `agent` ขึ้นไป — เห็น Ticket ทั้งหมด, รับงาน, เปลี่ยนสถานะ, เข้าหน้างานธุรการ
export const STAFF_ROLES = rolesAtLeast("agent")
/// `manager` ขึ้นไป — มอบหมายงาน, อนุมัติคำขอ, Publish KB, export รายงาน
export const MANAGER_ROLES = rolesAtLeast("manager")
/// `admin` เท่านั้น — ตั้งค่า SLA/Catalog/ปฏิทิน, จัดการผู้ใช้, คลังเอกสาร RAG
export const ADMIN_ROLES = rolesAtLeast("admin")

/// แปลงค่า role จาก session (อาจเป็น "agent,manager") ให้เป็น array
/// ค่าที่ไม่รู้จักถูกตัดทิ้ง และถ้าไม่เหลืออะไรเลยจะได้ `["user"]` เป็นค่าตั้งต้น
export function parseRoles(raw?: string | null): Role[] {
    const list = (raw || "user")
        .split(",")
        .map((r) => r.trim())
        .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
    return list.length > 0 ? list : ["user"]
}

/// รูปแบบย่อที่ตัวช่วยด้านล่างต้องการ — ใช้ได้ทั้ง AuthUser ฝั่ง server และ state ฝั่ง client
export interface HasRoles {
    roles: Role[]
}

export function hasRole(user: HasRoles, role: Role): boolean {
    return user.roles.includes(role)
}

export function isAtLeast(user: HasRoles, min: Role): boolean {
    return user.roles.some((r) => ROLE_RANK[r] >= ROLE_RANK[min])
}

/// `agent` ขึ้นไป
export function isStaff(user: HasRoles): boolean {
    return isAtLeast(user, "agent")
}

/// `manager` ขึ้นไป
export function isManager(user: HasRoles): boolean {
    return isAtLeast(user, "manager")
}

export function isAdmin(user: HasRoles): boolean {
    return hasRole(user, "admin")
}

// ── รูปแบบที่ฝั่ง client เรียกสะดวกกว่า (รับ string[] ดิบจาก session) ──────

/// เทียบจาก array ของ string ที่ยังไม่ผ่าน parseRoles — คอมโพเนนต์ส่วนใหญ่มีค่านี้ในมือ
export function rolesAreAtLeast(roles: readonly string[], min: Role): boolean {
    return roles.some((r) => (ROLE_RANK[r as Role] ?? -1) >= ROLE_RANK[min])
}

/// `agent` ขึ้นไป — รูปแบบรับ string[] สำหรับ client component
export function rolesAreStaff(roles: readonly string[]): boolean {
    return rolesAreAtLeast(roles, "agent")
}

/// `manager` ขึ้นไป — รูปแบบรับ string[] สำหรับ client component
export function rolesAreManager(roles: readonly string[]): boolean {
    return rolesAreAtLeast(roles, "manager")
}

/// `admin` — รูปแบบรับ string[] สำหรับ client component
export function rolesAreAdmin(roles: readonly string[]): boolean {
    return roles.includes("admin")
}
