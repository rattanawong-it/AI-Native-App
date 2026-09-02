import { Metadata } from "next"
import KbManageContent from "@/app/(main)/management/kb/KbManageContent"

export const metadata: Metadata = {
    title: "จัดการบทความ",
    description: "เขียน ตรวจทาน และเผยแพร่บทความคลังความรู้ของศูนย์ไอที",
    keywords: ["Knowledge Base", "จัดการบทความ", "เผยแพร่", "ศูนย์ไอที"],
}

export default function KbManagePage() {
    return <KbManageContent />
}
