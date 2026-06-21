import LineGroupsContent from "@/app/(main)/admin/line-groups/LineGroupsContent"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "LINE Groups",
    description: "จัดการกลุ่ม LINE ที่ Bot เข้าร่วม — เปิด/ปิดการแจ้งเตือน",
}

export default async function LineGroupsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session) {
        redirect("/dashboard")
    }

    // ตรวจสอบว่าเป็น Admin เท่านั้นที่เข้าถึงได้
    const userRoles = (session.user.role ?? "user").split(",").map((r: string) => r.trim())
    if (!userRoles.includes("admin")) {
        redirect("/dashboard")
    }

    return <LineGroupsContent />
}