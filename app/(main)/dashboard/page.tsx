import DashboardContent from "@/app/(main)/dashboard/DashboardContent"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Dashboard",
    description:
        "แดชบอร์ด AI Native App — ศูนย์กลางการจัดการระบบ AI ครบวงจร ดูสถิติการใช้งาน, จัดการ Knowledge Base, AI Chat และตั้งค่าระบบทั้งหมดได้ในที่เดียว",
    keywords: [
        "Dashboard",
        "แดชบอร์ด",
        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}

export default function DashboardPage() {
    return <DashboardContent />
}