import { Metadata } from "next"
import QueueContent from "@/app/(main)/service/tickets/queue/QueueContent"

export const metadata: Metadata = {
    title: "คิวงานทีม",
    description: "คิวงานที่ยังไม่ปิด จัดกลุ่มตามระดับความสำคัญ พร้อมภาระงานรายคน",
    keywords: ["คิวงาน", "ภาระงาน", "Ticket", "ศูนย์ไอที"],
}

export default function QueuePage() {
    return <QueueContent />
}
