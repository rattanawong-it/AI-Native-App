import { Metadata } from "next"
import MyWorkContent from "@/app/(main)/service/my-work/MyWorkContent"

export const metadata: Metadata = {
    title: "งานของฉัน",
    description: "Ticket ที่ได้รับมอบหมาย งานโครงการ งานส่วนตัว และบันทึกเวลาทำงานในที่เดียว",
    keywords: ["My Work", "งานของฉัน", "To-do", "Time Log", "ศูนย์ไอที"],
}

export default function MyWorkPage() {
    return <MyWorkContent />
}
