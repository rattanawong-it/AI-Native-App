// lib/rbac.ts
// Helper กลางสำหรับตรวจสิทธิ์ใน API route ทุกเส้นของระบบ ITSM
// อ้างอิง docs/spec.md §7 (RBAC Matrix) และ NFR1 / NFR3
//
// รูปแบบการใช้งานในทุก route (คงตาม pattern เดิมของแอป):
//
//   const guard = await requireRole(["agent", "manager", "admin"])
//   if (!guard.ok) return guard.response
//   const { user } = guard

import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/// 5 roles ของระบบ เรียงจากสิทธิ์น้อย → มาก
export const ROLES = ["student", "user", "agent", "manager", "admin"] as const
export type Role = (typeof ROLES)[number]

/// ลำดับชั้นของ role — ใช้เทียบว่า "อย่างน้อยระดับนี้ขึ้นไป"
const ROLE_RANK: Record<Role, number> = {
    student: 0,
    user: 1,
    agent: 2,
    manager: 3,
    admin: 4,
}

/// ผู้ใช้ที่ผ่านการยืนยันตัวตนแล้ว (รูปแบบย่อที่ API ใช้จริง)
export interface AuthUser {
    id: string
    name: string
    email: string
    /// role ทั้งหมดของผู้ใช้ (รองรับ multi-role คั่นด้วย comma เหมือน sidebar เดิม)
    roles: Role[]
}

type Guard =
    | { ok: true; user: AuthUser }
    | { ok: false; response: NextResponse }

/// แปลงค่า role จาก session (อาจเป็น "agent,manager") ให้เป็น array
export function parseRoles(raw?: string | null): Role[] {
    const list = (raw || "user")
        .split(",")
        .map((r) => r.trim())
        .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
    return list.length > 0 ? list : ["user"]
}

/// ดึง session ปัจจุบัน — คืน null ถ้ายังไม่ได้ login
export async function getAuthUser(): Promise<AuthUser | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null

    const u = session.user as { id: string; name: string; email: string; role?: string }
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        roles: parseRoles(u.role),
    }
}

/// ต้อง login เท่านั้น — ไม่ตรวจ role
export async function requireAuth(): Promise<Guard> {
    const user = await getAuthUser()
    if (!user) {
        return {
            ok: false,
            response: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }),
        }
    }
    return { ok: true, user }
}

/// ต้อง login + มี role อย่างน้อยหนึ่งตัวที่อยู่ในรายการที่อนุญาต
export async function requireRole(allowed: Role[]): Promise<Guard> {
    const guard = await requireAuth()
    if (!guard.ok) return guard

    if (!guard.user.roles.some((r) => allowed.includes(r))) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "คุณไม่มีสิทธิ์เข้าถึงรายการนี้" },
                { status: 403 }
            ),
        }
    }
    return guard
}

/// ต้องมีสิทธิ์อย่างน้อยระดับ role ที่กำหนด (ใช้ลำดับชั้น)
export async function requireMinRole(min: Role): Promise<Guard> {
    return requireRole(ROLES.filter((r) => ROLE_RANK[r] >= ROLE_RANK[min]))
}

// ── ตัวช่วยเชิงบทบาท (ใช้ได้ทั้งฝั่ง server และ client) ──────────────

export function hasRole(user: Pick<AuthUser, "roles">, role: Role): boolean {
    return user.roles.includes(role)
}

export function isAtLeast(user: Pick<AuthUser, "roles">, min: Role): boolean {
    return user.roles.some((r) => ROLE_RANK[r] >= ROLE_RANK[min])
}

/// `agent` ขึ้นไป — เห็น Ticket ทั้งหมด, รับงาน, เปลี่ยนสถานะ
export function isStaff(user: Pick<AuthUser, "roles">): boolean {
    return isAtLeast(user, "agent")
}

/// `manager` ขึ้นไป — มอบหมายงาน, อนุมัติคำขอ, Publish KB, รายงานรวม
export function isManager(user: Pick<AuthUser, "roles">): boolean {
    return isAtLeast(user, "manager")
}

export function isAdmin(user: Pick<AuthUser, "roles">): boolean {
    return hasRole(user, "admin")
}

// ── Row-level check (NFR3) ────────────────────────────────────────────

/// Ticket แบบย่อสำหรับตรวจสิทธิ์ระดับแถว
export interface TicketOwnership {
    requesterId: string
    assigneeId?: string | null
}

/// อ่าน Ticket ได้ไหม — `agent` ขึ้นไปอ่านได้ทั้งหมด, ที่เหลืออ่านได้เฉพาะของตัวเอง
export function canAccessTicket(user: AuthUser, ticket: TicketOwnership): boolean {
    if (isStaff(user)) return true
    return ticket.requesterId === user.id
}

/// แก้ไข Ticket ได้ไหม — `manager` ขึ้นไปแก้ได้ทั้งหมด, `agent` แก้ได้เฉพาะงานที่ถือ
export function canUpdateTicket(user: AuthUser, ticket: TicketOwnership): boolean {
    if (isManager(user)) return true
    if (isStaff(user)) return ticket.assigneeId === user.id || ticket.assigneeId == null
    return false
}

/// มอบหมาย / โยกย้ายงานได้ไหม — `manager` ขึ้นไปได้ทุกใบ, `agent` ได้เฉพาะใบที่ตัวเองถือ
export function canAssignTicket(user: AuthUser, ticket: TicketOwnership): boolean {
    if (isManager(user)) return true
    return isStaff(user) && ticket.assigneeId === user.id
}

/// เงื่อนไข where ของ Prisma สำหรับจำกัดให้เห็นเฉพาะ Ticket ของตัวเอง
export function ticketScopeWhere(user: AuthUser): { requesterId?: string } {
    return isStaff(user) ? {} : { requesterId: user.id }
}

// ── Response helper ที่ใช้ซ้ำทุก route ────────────────────────────────

export function unauthorized(message = "กรุณาเข้าสู่ระบบ") {
    return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = "คุณไม่มีสิทธิ์เข้าถึงรายการนี้") {
    return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = "ไม่พบข้อมูลที่ต้องการ") {
    return NextResponse.json({ error: message }, { status: 404 })
}

export function badRequest(message = "ข้อมูลไม่ถูกต้อง", issues?: unknown) {
    return NextResponse.json({ error: message, issues }, { status: 400 })
}
