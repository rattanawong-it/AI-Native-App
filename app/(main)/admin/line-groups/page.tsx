import { requireScreen } from "@/lib/screen-guard"
import LineGroupsContent from "@/app/(main)/admin/line-groups/LineGroupsContent"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "LINE Groups",
    description: "จัดการกลุ่ม LINE ที่ Bot เข้าร่วม — เปิด/ปิดการแจ้งเตือน",
}

export default async function LineGroupsPage() {
    // สิทธิ์ admin ถูกกันไว้ที่ app/(main)/admin/layout.tsx แล้ว
    // เรียกซ้ำที่นี่เพื่อไม่ให้หน้าหลุดถ้ามีใครย้ายไฟล์ออกจากกลุ่ม /admin ในอนาคต
    await requireScreen("SYSTEM_ADMIN")

    return <LineGroupsContent />
}