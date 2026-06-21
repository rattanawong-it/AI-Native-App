import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import UsersManagement from "./UsersManagement"

export const metadata = {
    title: "User Management | Admin",
}

export default async function AdminUsersPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    // ถ้าไม่ใช่ Admin → redirect กลับ Dashboard (รองรับ multi-role)
    if (!session) {
        redirect("/dashboard")
    }

    const userRoles = (session.user.role ?? "user").split(",").map((r: string) => r.trim())
    if (!userRoles.includes("admin")) {
        redirect("/dashboard")
    }

    return <UsersManagement />
}