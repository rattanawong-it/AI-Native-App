import { Metadata } from "next"
import CalendarContent from "@/app/(main)/admin/calendar/CalendarContent"

export const metadata: Metadata = {
    title: "ปฏิทินทำการ",
    description: "ตั้งค่าเวลาทำการรายสัปดาห์และวันหยุดราชการที่ใช้คำนวณกำหนดเวลา SLA",
    keywords: ["เวลาทำการ", "วันหยุดราชการ", "SLA", "ศูนย์ไอที"],
}

export default function CalendarSettingPage() {
    return <CalendarContent />
}
