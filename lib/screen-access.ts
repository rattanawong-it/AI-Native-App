// lib/screen-access.ts
// ผังกลุ่มสิทธิ์เข้าถึงหน้าจอ — โค้ดคู่กับตารางใน docs/spec.md §7.2
//
// ไฟล์นี้ไม่ import อะไรจาก next/ (นอกจากชนิดข้อมูล) เพราะต้องใช้ได้ทั้งใน
// middleware (edge runtime), layout ฝั่ง server และแบบทดสอบ
//
// ── หน้าที่แบ่งกันระหว่างสองชั้น ────────────────────────────────────────
// middleware.ts   ตรวจแค่ว่า "ต้อง login ไหม" — ดูจาก cookie เท่านั้น
//                 อ่าน role จาก cookie ไม่ได้ (session อยู่ใน DB) จึงตรวจ role ที่นี่ไม่ได้
// layout / page   ตรวจ role จริงด้วย requireScreen() ใน lib/screen-guard.ts
//
// กันสองชั้นแบบนี้ทำให้ผู้ที่ยังไม่ login ถูกตีกลับตั้งแต่ขอบ ส่วนผู้ที่ login แล้ว
// แต่ role ไม่ถึง จะถูกตีกลับก่อน render เนื้อหาใดๆ

import { ROLE_RANK, type Role } from "@/lib/roles"

/// คีย์กลุ่มตาม docs/spec.md §7.2 (9 กลุ่ม)
export type ScreenGroupKey =
    | "PUBLIC"
    | "COMMON"
    | "SELF_SERVICE"
    | "STAFF_WORK"
    | "OPERATIONS"
    | "SDLC"
    | "CRM"
    | "SERVICE_CONFIG"
    | "SYSTEM_ADMIN"

export interface ScreenGroup {
    key: ScreenGroupKey
    /// ชื่อกลุ่มภาษาไทย — ใช้ในข้อความแจ้งเมื่อถูกปฏิเสธและในเอกสาร
    label: string
    /// role ต่ำสุดที่เข้าได้ — `null` = ไม่ต้อง login
    minRole: Role | null
    /// prefix ของเส้นทางที่อยู่ในกลุ่มนี้ (เทียบแบบ "ตรงตัวหรือขึ้นต้นด้วย prefix + /")
    paths: string[]
}

/// เรียงจาก **เจาะจงมากไปน้อย** — resolveScreenGroup() คืนกลุ่มแรกที่ตรง
/// กลุ่มที่ prefix ซ้อนกันจึงต้องวางตัวที่ลึกกว่าไว้ก่อน เช่น
/// `/management/lead` (CRM) ต้องมาก่อน `/management` (OPERATIONS)
export const SCREEN_GROUPS: ScreenGroup[] = [
    {
        key: "PUBLIC",
        label: "สาธารณะ",
        minRole: null,
        paths: ["/", "/auth"],
    },
    {
        key: "SYSTEM_ADMIN",
        label: "ผู้ดูแลระบบ",
        minRole: "admin",
        paths: ["/admin/users", "/admin/knowledge", "/admin/line-groups", "/admin/settings"],
    },
    {
        key: "SERVICE_CONFIG",
        label: "ตั้งค่าบริการ",
        minRole: "admin",
        paths: ["/admin/catalog", "/admin/sla", "/admin/calendar"],
    },
    {
        key: "CRM",
        label: "ลูกค้าสัมพันธ์",
        minRole: "manager",
        paths: ["/management/lead"],
    },
    {
        key: "SDLC",
        label: "งานพัฒนา",
        minRole: "agent",
        paths: ["/management/projects", "/management/teams"],
    },
    {
        key: "STAFF_WORK",
        label: "งานเจ้าหน้าที่",
        minRole: "agent",
        paths: ["/service/my-work", "/service/tickets/queue", "/management/kb"],
    },
    {
        key: "OPERATIONS",
        label: "งานธุรการศูนย์",
        minRole: "agent",
        paths: ["/management/assets", "/management/requests", "/management/reports"],
    },
    {
        key: "SELF_SERVICE",
        label: "บริการตนเอง",
        minRole: "student",
        paths: ["/service/tickets", "/service/kb"],
    },
    {
        key: "COMMON",
        label: "ใช้ร่วมทุกคน",
        minRole: "student",
        paths: ["/dashboard", "/search", "/chat", "/profile", "/help"],
    },
]

/// เส้นทางที่เหลือทั้งหมด (ไม่ตรงกลุ่มไหนเลย) ถือว่าต้อง login เป็นอย่างน้อย
/// ตั้งใจให้ค่าตั้งต้นเป็นฝั่งปิด — หน้าใหม่ที่ลืมใส่ในตารางจะถูกกัน ไม่ใช่ถูกปล่อย
const FALLBACK: ScreenGroup = {
    key: "COMMON",
    label: "ใช้ร่วมทุกคน",
    minRole: "student",
    paths: [],
}

function matches(pathname: string, prefix: string): boolean {
    if (prefix === "/") return pathname === "/"
    return pathname === prefix || pathname.startsWith(prefix + "/")
}

/// หากลุ่มสิทธิ์ของเส้นทางหนึ่ง — คืนกลุ่มแรกใน SCREEN_GROUPS ที่ prefix ตรง
export function resolveScreenGroup(pathname: string): ScreenGroup {
    // ตัด trailing slash ทิ้งก่อน เพื่อให้ "/admin/sla/" เทียบได้เหมือน "/admin/sla"
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname

    for (const group of SCREEN_GROUPS) {
        if (group.paths.some((p) => matches(path, p))) return group
    }
    return FALLBACK
}

/// เส้นทางนี้เปิดให้ผู้ที่ยังไม่ login ไหม
export function isPublicPath(pathname: string): boolean {
    return resolveScreenGroup(pathname).minRole === null
}

/// role ชุดนี้เข้าเส้นทางนี้ได้ไหม (ใช้ได้ทั้งฝั่ง server และในแบบทดสอบ)
export function canAccessScreen(roles: readonly string[], pathname: string): boolean {
    const { minRole } = resolveScreenGroup(pathname)
    if (minRole === null) return true
    return roles.some((r) => (ROLE_RANK[r as Role] ?? -1) >= ROLE_RANK[minRole])
}
