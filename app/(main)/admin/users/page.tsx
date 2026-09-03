import { requireScreen } from "@/lib/screen-guard"
import UsersManagement from "./UsersManagement"

export const metadata = {
    title: "User Management | Admin",
}

export default async function AdminUsersPage() {
    // สิทธิ์ admin ถูกกันไว้ที่ app/(main)/admin/layout.tsx แล้ว
    // เรียกซ้ำที่นี่เพื่อไม่ให้หน้าหลุดถ้ามีใครย้ายไฟล์ออกจากกลุ่ม /admin ในอนาคต
    await requireScreen("SYSTEM_ADMIN")

    return <UsersManagement />
}