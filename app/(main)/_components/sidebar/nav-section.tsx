"use client"

import { useState } from "react"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NavSectionType } from "./sidebar-data"
import { NavItem } from "./nav-item"

interface NavSectionProps {
    section: NavSectionType
    collapsed?: boolean
    defaultOpen?: boolean
}

export function NavSection({ section, collapsed, defaultOpen = true }: NavSectionProps) {
    const [open, setOpen] = useState(defaultOpen)

    // ถ้าไม่มี title (เช่น Dashboard) แสดง items ปกติ
    if (!section.title) {
        return (
            <nav className="space-y-1">
                {section.items.map((item) => (
                    <NavItem key={item.href} item={item} collapsed={collapsed} />
                ))}
            </nav>
        )
    }

    // ถ้า collapsed แสดงเฉพาะ icons
    if (collapsed) {
        return (
            <nav className="space-y-1">
                {section.items.map((item) => (
                    <NavItem key={item.href} item={item} collapsed={collapsed} />
                ))}
            </nav>
        )
    }

    // แสดงเป็น collapsible section
    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
                <span>{section.title}</span>
                <ChevronUp
                    className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        !open && "rotate-180"
                    )}
                />
            </button>
            {open && (
                <nav className="mt-1 space-y-1">
                    {section.items.map((item) => (
                        <NavItem key={item.href} item={item} collapsed={collapsed} />
                    ))}
                </nav>
            )}
        </div>
    )
}