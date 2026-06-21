import ProjectContent from "@/app/(main)/management/projects/ProjectContent"

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Projects",
    description:
        "แดชบอร์ด AI Native App — ศูนย์กลางการจัดการโปรเจกต์ AI ครบวงจร ดูสถิติการใช้งาน, จัดการ Knowledge Base, AI Chat และตั้งค่าระบบทั้งหมดได้ในที่เดียว",
    keywords: [
        "Projects",
        "โปรเจกต์",
        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}

export default function ProjectsPage() {
  return <ProjectContent />
}