import KnowledgeBase from "@/app/(main)/admin/knowledge/KnowledgeBase"

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Knowledge Base",
    description:
        "Knowledge Base — ศูนย์กลางการจัดการระบบ AI ครบวงจร ดูสถิติการใช้งาน, จัดการ Knowledge Base, AI Chat และตั้งค่าระบบทั้งหมดได้ในที่เดียว",
    keywords: [
        "Knowledge Base",
        "การจัดการความรู้",
        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}

export default function KnowledgePage() {
  return (
    <KnowledgeBase />
  )
}