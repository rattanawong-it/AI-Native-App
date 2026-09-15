import { Metadata } from "next"
import MyWorkContent from "@/app/(main)/service/my-work/MyWorkContent"
import { requireScreen } from "@/lib/screen-guard"

export const metadata: Metadata = {
    title: "งานของฉัน",
    description: "Ticket ที่ได้รับมอบหมาย งานโครงการ งานส่วนตัว และบันทึกเวลาทำงานในที่เดียว",
    keywords: ["My Work", "งานของฉัน", "To-do", "Time Log", "ศูนย์ไอที"],
}

export default async function MyWorkPage({
    searchParams,
}: {
    searchParams: Promise<{ userId?: string }>
}) {
    // กลุ่ม 4 งานเจ้าหน้าที่ — /service ที่เหลือเปิดให้ทุก role จึงกันที่หน้านี้เอง
    await requireScreen("STAFF_WORK")
    // ?userId= ให้ admin เปิดตรวจสอบ My Work ของผู้อื่น — API ตรวจสิทธิ์ซ้ำทุกเส้น (spec §20)
    const { userId } = await searchParams
    return <MyWorkContent initialUserId={userId} />
}
