import { Metadata } from "next"
import KbEditContent from "@/app/(main)/management/kb/[id]/edit/KbEditContent"

export const metadata: Metadata = {
    title: "แก้ไขบทความ",
    description: "แก้ไขบทความคลังความรู้และจัดการสถานะการเผยแพร่",
    keywords: ["Knowledge Base", "แก้ไขบทความ", "เผยแพร่", "ศูนย์ไอที"],
}

export default async function KbEditPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <KbEditContent articleId={id} />
}
