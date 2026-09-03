import { Metadata } from "next"
import QueueContent from "@/app/(main)/service/tickets/queue/QueueContent"
import { requireScreen } from "@/lib/screen-guard"

export const metadata: Metadata = {
    title: "คิวงานทีม",
    description: "คิวงานที่ยังไม่ปิด จัดกลุ่มตามระดับความสำคัญ พร้อมภาระงานรายคน",
    keywords: ["คิวงาน", "ภาระงาน", "Ticket", "ศูนย์ไอที"],
}

export default async function QueuePage() {
    // กลุ่ม 4 งานเจ้าหน้าที่ — เส้นทางนี้ไม่มีในเมนู แต่พิมพ์ URL เข้าได้ จึงต้องกันฝั่ง server
    await requireScreen("STAFF_WORK")
    return <QueueContent />
}
