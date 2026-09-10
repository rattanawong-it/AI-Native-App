// app/api/directory/route.ts
// GET — รายชื่อสำหรับเติม dropdown ในหน้า Ticket และ Service Catalog
//   ?scope=agents     เจ้าหน้าที่ที่รับงานได้ (มอบหมาย / ผู้รับผิดชอบเริ่มต้นของหมวดหมู่)
//   ?scope=teams      ทีมงานที่เปิดใช้งาน
//   ?scope=users&q=   ค้นหาผู้ใช้เพื่อแจ้งปัญหาแทน (F1.10)
//   ?scope=google&q=  ค้นบุคลากรจาก Google Workspace Directory ของมหาวิทยาลัย (spec §19)
//   ?scope=all        ทั้ง agents + teams (ค่าเริ่มต้น)
//
// เป็นข้อมูลรายชื่อภายในองค์กร จึงจำกัดไว้ที่ระดับเจ้าหน้าที่ขึ้นไป (spec §7)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, STAFF_ROLES } from "@/lib/rbac"
import { ASSIGNABLE_USER_WHERE, WORKLOAD_STATUSES } from "@/lib/ticket-service"
import { getDirectoryToken, searchDirectory } from "@/lib/google-directory"
import type { GoogleDirectoryResponse } from "@/lib/ticket-types"

const personSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
    position: true,
    role: true,
} as const

/// ผู้ใช้ที่ถือ role ระดับเจ้าหน้าที่ขึ้นไปและยังรับงานได้
/// ใช้เงื่อนไขชุดเดียวกับ auto-assign เพื่อให้รายชื่อในหน้าจอตรงกับคนที่ระบบมอบงานให้จริง
const STAFF_ROLE_FILTER = ASSIGNABLE_USER_WHERE

export async function GET(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response

    const url = new URL(request.url)
    const scope = url.searchParams.get("scope") ?? "all"
    const q = (url.searchParams.get("q") ?? "").trim()

    try {
        if (scope === "google") {
            return NextResponse.json(await searchGoogleDirectory(guard.user.id, q))
        }

        if (scope === "users") {
            const users = await prisma.user.findMany({
                where: q
                    ? {
                          OR: [
                              { name: { contains: q, mode: "insensitive" } },
                              { email: { contains: q, mode: "insensitive" } },
                              { employeeCode: { contains: q, mode: "insensitive" } },
                          ],
                      }
                    : {},
                orderBy: { name: "asc" },
                take: 20,
                select: { ...personSelect, employeeCode: true, departmentId: true },
            })
            return NextResponse.json({ users })
        }

        if (scope === "teams") {
            const teams = await prisma.team.findMany({
                where: { active: true },
                orderBy: { name: "asc" },
                select: { id: true, name: true, description: true },
            })
            return NextResponse.json({ teams })
        }

        const [agents, teams] = await Promise.all([
            prisma.user.findMany({
                where: STAFF_ROLE_FILTER,
                orderBy: { name: "asc" },
                select: {
                    ...personSelect,
                    // จำนวนงานที่ถืออยู่ — ใช้โชว์ประกอบการเลือกผู้รับผิดชอบในหน้า Catalog (F2.12)
                    _count: {
                        select: {
                            ticketsAssigned: {
                                where: { status: { in: [...WORKLOAD_STATUSES] } },
                            },
                        },
                    },
                },
            }),
            scope === "agents"
                ? Promise.resolve([])
                : prisma.team.findMany({
                      where: { active: true },
                      orderBy: { name: "asc" },
                      select: { id: true, name: true, description: true },
                  }),
        ])

        // แปลง _count เป็น openTickets เพื่อให้ฝั่ง UI อ่านง่ายและ contract เดิมไม่เปลี่ยน
        const agentsWithLoad = agents.map(({ _count, ...agent }) => ({
            ...agent,
            openTickets: _count.ticketsAssigned,
        }))

        return NextResponse.json({ agents: agentsWithLoad, teams })
    } catch (error) {
        console.error("Directory GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อได้" }, { status: 500 })
    }
}

/// ค้นบุคลากรจาก Google ด้วย token ของเจ้าหน้าที่ที่เรียก แล้วติด userId ให้คนที่มีบัญชีแล้ว
/// ปัญหาฝั่ง Google คืนเป็น status (200) ไม่ใช่ error — หน้าจอยังค้นจากในระบบได้ตามปกติ
async function searchGoogleDirectory(userId: string, q: string): Promise<GoogleDirectoryResponse> {
    const token = await getDirectoryToken(userId)
    if (token.status !== "ok") return { status: token.status, people: [] }
    if (q.length < 2) return { status: "ok", people: [] }

    const result = await searchDirectory(token.token, q)
    if (result.status !== "ok") return { status: result.status, people: [] }
    if (result.people.length === 0) return { status: "ok", people: [] }

    const existing = await prisma.user.findMany({
        where: {
            OR: result.people.map((p) => ({ email: { equals: p.email, mode: "insensitive" as const } })),
        },
        select: { id: true, email: true },
    })
    const idByEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u.id]))

    return {
        status: "ok",
        people: result.people.map((p) => ({ ...p, userId: idByEmail.get(p.email) ?? null })),
    }
}
