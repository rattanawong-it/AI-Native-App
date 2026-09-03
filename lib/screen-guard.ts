// lib/screen-guard.ts
// ตัวกันหน้าจอฝั่ง server — เรียกจาก layout หรือ page ที่เป็น Server Component
//
//   export default async function Layout({ children }) {
//       await requireScreen("OPERATIONS")
//       return <>{children}</>
//   }
//
// ต่างจาก requireRole() ใน lib/rbac.ts ตรงที่ตัวนั้นคืน NextResponse ให้ API route
// ส่วนตัวนี้ redirect ผู้ใช้ไปหน้าที่เข้าได้แทน เพราะผู้ใช้กำลังเปิดหน้าเว็บอยู่

import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/rbac"
import { isAtLeast } from "@/lib/roles"
import { SCREEN_GROUPS, type ScreenGroupKey } from "@/lib/screen-access"
import type { AuthUser } from "@/lib/rbac"

/// ต้อง login + role ถึงเกณฑ์ของกลุ่มหน้าจอที่ระบุ ไม่ถึงจะถูกพากลับ
///
/// - ยังไม่ login → `/auth/signin` (middleware ดักไว้ก่อนแล้ว นี่คือชั้นสำรอง)
/// - login แล้วแต่ role ไม่ถึง → `/dashboard` ซึ่งทุก role ที่ login เข้าได้
///
/// คืน AuthUser กลับไปด้วย หน้าที่เรียกจึงไม่ต้องดึง session ซ้ำ
export async function requireScreen(key: ScreenGroupKey): Promise<AuthUser> {
    const group = SCREEN_GROUPS.find((g) => g.key === key)
    if (!group) throw new Error(`ไม่รู้จักกลุ่มหน้าจอ "${key}" — ดู lib/screen-access.ts`)

    const user = await getAuthUser()
    if (!user) redirect("/auth/signin")

    if (group.minRole !== null && !isAtLeast(user, group.minRole)) {
        redirect("/dashboard")
    }

    return user
}
