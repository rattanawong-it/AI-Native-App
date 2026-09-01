"use client"

import { usePathname } from "next/navigation"
import { sidebarData, bottomNavItems } from "../sidebar/sidebar-data"
import  UserMenu  from "./UserMenu"
import { ImpersonationBanner } from "./impersonation-banner"

export function Header() {
    const pathname = usePathname()

    // หน้าที่ไม่อยู่ใน sidebar แต่ต้องแสดง title
    const pageTitles: Record<string, string> = {
        "/profile": "โปรไฟล์ของฉัน",
        "/service/tickets/queue": "คิวงานทีม",
    }

    // หน้าที่ path เปลี่ยนไปตามข้อมูล (เช่น /service/tickets/<id>) จับด้วย pattern
    const dynamicTitles: { pattern: RegExp; title: string }[] = [
        { pattern: /^\/service\/tickets\/[^/]+$/, title: "รายละเอียด Ticket" },
    ]

    // รวม items ทั้งหมดจาก sidebar แล้วหา title ที่ตรงกับ pathname
    const allItems = [
        ...sidebarData.flatMap((section) => section.items),
        ...bottomNavItems,
    ]
    const matched = allItems.find((item) => pathname === item.href)

    // ถ้าไม่ตรงแบบเป๊ะ ให้ถอยไปใช้เมนูที่เป็นต้นทางของ path นี้ (href ยาวสุดที่ครอบอยู่)
    // เพื่อให้หน้าย่อยที่จะเพิ่มในเฟสถัดไปมีหัวข้อโดยไม่ต้องมาแก้ไฟล์นี้ซ้ำ
    const parent = allItems
        .filter((item) => item.href !== "/" && pathname.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]

    const title =
        matched?.title ??
        pageTitles[pathname] ??
        dynamicTitles.find((d) => d.pattern.test(pathname))?.title ??
        parent?.title ??
        "Dashboard"

    return (
        <>
        {/* Impersonation Banner — แสดงเมื่อ Admin กำลัง Impersonate */}
        <ImpersonationBanner />

        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold text-foreground">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-3">
                <UserMenu />
            </div>
        </header>
        </>
    )
}