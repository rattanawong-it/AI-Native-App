import TeamContent from "@/app/(main)/management/teams/TeamContent"

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "ทีมงาน",
    description:
        "จัดการทีมงานของศูนย์ไอทีและสมาชิกในแต่ละทีม — ทีมเดียวกันนี้ใช้มอบหมาย Ticket หมวดหมู่บริการ และโครงการพัฒนา",
    keywords: [
        "ทีมงาน",
        "Team",
        "สมาชิกทีม",
        "หัวหน้าทีม",
        "ศูนย์ไอที",
        "มอบหมายงาน",
    ],
}

export default function TeamsPage() {
    return <TeamContent />
}
