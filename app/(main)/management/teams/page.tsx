  import TeamContent from "@/app/(main)/management/teams/TeamContent"

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Teams",
    description:
        "แดชบอร์ด AI Native App — ศูนย์กลางการจัดการทีม AI ครบวงจร ดูสถิติการใช้งาน, จัดการ Knowledge Base, AI Chat และตั้งค่าระบบทั้งหมดได้ในที่เดียว",
    keywords: [
        "Teams",
        "ทีม",
        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}


export default function TeamsPage() {
  return <TeamContent />
}