import { Metadata } from "next"
import MyWorkContent from "@/app/(main)/service/my-work/MyWorkContent"
import { requireScreen } from "@/lib/screen-guard"

export const metadata: Metadata = {
    title: "งานของฉัน",
    description: "Ticket ที่ได้รับมอบหมาย งานโครงการ งานส่วนตัว และบันทึกเวลาทำงานในที่เดียว",
    keywords: ["My Work", "งานของฉัน", "To-do", "Time Log", "ศูนย์ไอที"],
}

export default async function MyWorkPage() {
    // กลุ่ม 4 งานเจ้าหน้าที่ — /service ที่เหลือเปิดให้ทุก role จึงกันที่หน้านี้เอง
    await requireScreen("STAFF_WORK")
    return <MyWorkContent />
}
