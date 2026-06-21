"use client"

import { useState } from "react"
import Link from "next/link"
import { PanelLeftClose, PanelLeft, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth-client"
import { sidebarData, bottomNavItems } from "./sidebar-data"
import { NavSection } from "./nav-section"
import { NavItem } from "./nav-item"

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false)
    const { data: session } = useSession()
    const userRoles = ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim())

    // กรอง section ตาม role ของผู้ใช้ (รองรับ multi-role)
    const filteredSections = sidebarData.filter(
        (section) => !section.allowedRoles || section.allowedRoles.some((r) => userRoles.includes(r))
    )

    return (
        <aside
            className={cn(
                "flex h-screen flex-col border-r border-border bg-background transition-all duration-300 overflow-hidden",
                collapsed ? "w-13" : "w-64",
                className
            )}
        >
            {/* Header: Logo + Collapse Toggle */}
            <div
                className={cn(
                    "flex h-14 shrink-0 items-center border-b border-border",
                    collapsed ? "justify-center px-2" : "justify-between px-4"
                )}
            >
                {!collapsed && (
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-purple-600 to-indigo-600 shadow-md">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-foreground">
                            AI Native
                        </span>
                    </Link>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? (
                        <PanelLeft className="h-4 w-4" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4" />
                    )}
                </button>
            </div>

            {/* Main Navigation — ใช้ filteredSections แทน sidebarData */}
            <div className="flex-1 overflow-y-auto">
                <div className={cn("py-4", collapsed ? "px-1" : "px-3")}>
                    <div className="space-y-2">
                        {filteredSections.map((section, index) => (
                            <NavSection
                                key={index}
                                section={section}
                                collapsed={collapsed}
                                defaultOpen={true}
                            />
                        ))}
                    </div>

                    {/* Bottom Navigation — ทุก role เห็น */}
                    <div className="mt-6 border-t border-border pt-4">
                        <nav className="space-y-1">
                            {bottomNavItems.map((item) => (
                                <NavItem key={item.href} item={item} collapsed={collapsed} />
                            ))}
                        </nav>
                    </div>
                </div>
            </div>
        </aside>

    )
}