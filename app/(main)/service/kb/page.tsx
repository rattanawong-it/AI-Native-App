import { Metadata } from "next"
import KbListContent from "@/app/(main)/service/kb/KbListContent"

export const metadata: Metadata = {
    title: "คลังความรู้",
    description: "รวมบทความวิธีแก้ปัญหา คู่มือการใช้งาน และคำถามที่พบบ่อยของศูนย์ไอที",
    keywords: ["Knowledge Base", "คลังความรู้", "คู่มือ", "FAQ", "ศูนย์ไอที"],
}

export default function KbPage() {
    return <KbListContent />
}
