// app/(main)/dashboard/page.tsx
// หน้าแรกหลัง login — เตรียมข้อมูลฝั่ง server แล้วส่งให้ client component วาด (F9.1)
//
// ช่วงย้อนหลังของ KPI/กราฟ ผูกไว้กับ query string `?range=7|30` แทน state ในหน้า
// ผู้ใช้จึงบุ๊กมาร์กมุมมองที่ชอบไว้ได้ และไม่ต้องรอ fetch รอบสองหลังหน้าโหลดเสร็จ (F9.5)

import { Metadata } from "next"
import { redirect } from "next/navigation"
import DashboardContent from "@/app/(main)/dashboard/DashboardContent"
import { getAuthUser } from "@/lib/rbac"
import { buildDashboard, normalizeRange } from "@/lib/dashboard-service"

export const metadata: Metadata = {
    title: "แดชบอร์ด",
    description:
        "ภาพรวมงานบริการของศูนย์เทคโนโลยีสารสนเทศ — Ticket ของฉัน งานที่ต้องทำ สถานะ SLA และ KPI ของทั้งศูนย์",
    keywords: ["แดชบอร์ด", "Dashboard", "ศูนย์ไอที", "Helpdesk", "SLA", "KPI"],
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ range?: string }>
}) {
    const user = await getAuthUser()
    if (!user) redirect("/auth/signin")

    const { range } = await searchParams
    const data = await buildDashboard(user, normalizeRange(range))

    return <DashboardContent data={data} />
}
