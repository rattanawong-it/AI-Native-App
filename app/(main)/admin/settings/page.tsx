import { requireScreen } from "@/lib/screen-guard"
import SettingContent from '@/app/(main)/admin/settings/SettingContent'

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
    // สิทธิ์ admin ถูกกันไว้ที่ app/(main)/admin/layout.tsx แล้ว
    // เรียกซ้ำที่นี่เพื่อไม่ให้หน้าหลุดถ้ามีใครย้ายไฟล์ออกจากกลุ่ม /admin ในอนาคต
    await requireScreen("SYSTEM_ADMIN")

    return <SettingContent />
}