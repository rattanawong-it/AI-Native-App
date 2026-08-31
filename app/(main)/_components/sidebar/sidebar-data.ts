import {
    LayoutDashboard,
    PanelsTopLeft,
    LibraryBig,
    Users,
    Component,
    Settings,
    MessageCircle,
    MessagesSquare,
    HelpCircle,
    ClipboardList,
    Ticket,
    FilePlus2,
    ListTodo,
    BookOpen,
    Package,
    FileCheck2,
    BarChart3,
    Layers,
    Clock,
    CalendarDays,
    type LucideIcon,
} from "lucide-react"

export interface NavItemType {
    title: string
    href: string
    icon: LucideIcon
    badge?: string
    allowedRoles?: string[]  // ถ้าไม่กำหนด = ทุก role เห็น (ระดับเมนูย่อย)
}

export interface NavSectionType {
    title?: string
    items: NavItemType[]
    allowedRoles?: string[]  // ถ้าไม่กำหนด = ทุก role เห็น
}

// กลุ่ม role ที่ใช้ซ้ำ — อ้างอิง docs/spec.md §7 (RBAC Matrix)
const STAFF = ["agent", "manager", "admin"]       // เจ้าหน้าที่ขึ้นไป
const MANAGER = ["manager", "admin"]              // หัวหน้าขึ้นไป
const ADMIN = ["admin"]

export const sidebarData: NavSectionType[] = [
    {
        // แดชบอร์ด — ทุก role เห็น (ไม่มี allowedRoles)
        items: [
            { title: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
        ],
    },
    {
        // งานบริการ (ITSM Helpdesk) — ทุก role เห็นหัวข้อ แต่บางเมนูจำกัดเฉพาะเจ้าหน้าที่
        title: "งานบริการ",
        items: [
            { title: "Ticket ทั้งหมด", href: "/service/tickets", icon: Ticket },
            { title: "แจ้งปัญหาใหม่", href: "/service/tickets/new", icon: FilePlus2 },
            { title: "My Work", href: "/service/my-work", icon: ListTodo, allowedRoles: STAFF },
        ],
    },
    {
        // ฐานความรู้ — ทุก role อ่านได้ (visibility คุมรายบทความอีกชั้น)
        title: "ฐานความรู้",
        items: [
            { title: "Knowledge Base", href: "/service/kb", icon: BookOpen },
        ],
    },
    {
        // AI & ข้อมูล — ทุก role เห็น (ไม่มี allowedRoles)
        title: "AI & ข้อมูล",
        items: [
            { title: "แชท AI", href: "/chat", icon: MessageCircle },
        ],
    },
    {
        // งานธุรการศูนย์ — เจ้าหน้าที่ขึ้นไป (agent อ่านครุภัณฑ์ / สร้างคำขอได้)
        title: "งานธุรการศูนย์",
        items: [
            { title: "ครุภัณฑ์ IT", href: "/management/assets", icon: Package },
            { title: "คำขออนุมัติ", href: "/management/requests", icon: FileCheck2 },
            { title: "รายงาน", href: "/management/reports", icon: BarChart3 },
        ],
        allowedRoles: STAFF,
    },
    {
        // บริหารจัดการ (ของเดิม) — เฉพาะ admin และ manager
        title: "บริหารจัดการ",
        items: [
            { title: "โครงการพัฒนา", href: "/management/projects", icon: PanelsTopLeft },
            { title: "ทีมงาน", href: "/management/teams", icon: Component },
            { title: "ผู้สนใจ (Lead)", href: "/management/lead", icon: ClipboardList },
        ],
        allowedRoles: MANAGER,
    },
    {
        // ตั้งค่าบริการ (ITSM) — เฉพาะ admin ตาม RBAC §7
        title: "ตั้งค่าบริการ",
        items: [
            { title: "Service Catalog", href: "/admin/catalog", icon: Layers },
            { title: "SLA Policy", href: "/admin/sla", icon: Clock },
            { title: "ปฏิทินทำการ", href: "/admin/calendar", icon: CalendarDays },
        ],
        allowedRoles: ADMIN,
    },
    {
        // ผู้ดูแลระบบ (ของเดิม) — เฉพาะ admin เท่านั้น
        title: "ผู้ดูแลระบบ",
        items: [
            { title: "ผู้ใช้งาน", href: "/admin/users", icon: Users },
            { title: "คลังเอกสาร RAG", href: "/admin/knowledge", icon: LibraryBig },
            { title: "กลุ่ม LINE", href: "/admin/line-groups", icon: MessagesSquare },
            { title: "ตั้งค่าระบบ", href: "/admin/settings", icon: Settings },
        ],
        allowedRoles: ADMIN,
    },
]

// ช่วยเหลือ — ทุก role เห็น (bottom nav แยกจาก sidebarData)
export const bottomNavItems: NavItemType[] = [
    { title: "ช่วยเหลือ", href: "/help", icon: HelpCircle },
]

/// กรอง section + item ตาม role ของผู้ใช้ (รองรับ multi-role)
/// section ที่ไม่เหลือ item เลยจะถูกตัดทิ้ง
export function filterSectionsByRole(
    sections: NavSectionType[],
    userRoles: string[]
): NavSectionType[] {
    const allowed = (roles?: string[]) => !roles || roles.some((r) => userRoles.includes(r))

    return sections
        .filter((section) => allowed(section.allowedRoles))
        .map((section) => ({ ...section, items: section.items.filter((item) => allowed(item.allowedRoles)) }))
        .filter((section) => section.items.length > 0)
}
