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
    type LucideIcon,
} from "lucide-react"

export interface NavItemType {
    title: string
    href: string
    icon: LucideIcon
    badge?: string
}

export interface NavSectionType {
    title?: string
    items: NavItemType[]
    allowedRoles?: string[]  // ถ้าไม่กำหนด = ทุก role เห็น
}

export const sidebarData: NavSectionType[] = [
    {
        // Dashboard — ทุก role เห็น (ไม่มี allowedRoles)
        items: [
            { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ],
    },
    {
        // AI & Data — ทุก role เห็น (ไม่มี allowedRoles)
        title: "AI & Data",
        items: [
            { title: "Chat", href: "/chat", icon: MessageCircle },
        ],
    },
    {
        // Management — เฉพาะ admin และ manager
        title: "Management",
        items: [
            { title: "Projects", href: "/management/projects", icon: PanelsTopLeft },
            { title: "Teams", href: "/management/teams", icon: Component },
            { title: "Leads", href: "/management/lead", icon: ClipboardList },
        ],
        allowedRoles: ["admin", "manager"],
    },
    {
        // Admin — เฉพาะ admin เท่านั้น
        title: "Admin",
        items: [
            { title: "Users", href: "/admin/users", icon: Users },
            { title: "Knowledge", href: "/admin/knowledge", icon: LibraryBig },
            { title: "LINE Groups", href: "/admin/line-groups", icon: MessagesSquare },
            { title: "Settings", href: "/admin/settings", icon: Settings },
        ],
        allowedRoles: ["admin"],
    },
]

// Help — ทุก role เห็น (bottom nav แยกจาก sidebarData)
export const bottomNavItems: NavItemType[] = [
    { title: "Help", href: "/help", icon: HelpCircle },
]