import HelpContent from '@/app/(main)/help/HelpContent'

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Help",
    description:
        "Help — ศูนย์กลางการจัดการระบบ AI ครบวงจร ดูสถิติการใช้งาน, จัดการ Knowledge Base, AI Chat และตั้งค่าระบบทั้งหมดได้ในที่เดียว",
    keywords: [
        "Help",
        "ช่วยเหลือ",
        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}

export default function HelpPage() {
  return <HelpContent />
}