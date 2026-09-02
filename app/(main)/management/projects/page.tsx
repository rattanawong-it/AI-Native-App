import ProjectContent from "@/app/(main)/management/projects/ProjectContent"

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "โครงการพัฒนา",
    description:
        "จัดการโครงการพัฒนาซอฟต์แวร์ของศูนย์ไอที — รอบพัฒนา (Sprint), กระดานงาน Kanban, ความคืบหน้า และทีมผู้รับผิดชอบ",
    keywords: [
        "โครงการพัฒนา",
        "Project",
        "Sprint",
        "Kanban",
        "Agile",
        "SDLC",
        "ศูนย์ไอที",
        "งานพัฒนาซอฟต์แวร์",
    ],
}

export default function ProjectsPage() {
    return <ProjectContent />
}
