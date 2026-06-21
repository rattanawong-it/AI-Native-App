import SettingContent from '@/app/(main)/admin/settings/SettingContent'
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Settings",
    description:
        "Settings — ศูนย์กลางการจัดการระบบ AI ครบวงจร ดูสถิติการใช้งาน, จัดการ Knowledge Base, AI Chat และตั้งค่าระบบทั้งหมดได้ในที่เดียว",
    keywords: [
        "Settings",
        "การตั้งค่า",

        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}


export default async function SettingPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session) {
        redirect("/dashboard")
    }

    // ตรวจสอบว่าเป็น Admin เท่านั้นที่เข้าถึงได้
    const userRoles = (session.user.role ?? "user").split(",").map((r: string) => r.trim())
    if (!userRoles.includes("admin")) {
        redirect("/dashboard")
    }

    return <SettingContent />
}