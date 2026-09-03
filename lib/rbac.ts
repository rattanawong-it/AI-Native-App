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
import { ROLES, ROLE_RANK, parseRoles, isStaff, isManager, type Role } from "@/lib/roles"

// ชื่อ role และตรรกะเทียบสิทธิ์ย้ายไปอยู่ที่ lib/roles.ts แล้ว (ไม่พึ่ง next/ จึงใช้ฝั่ง client ได้)
// ไฟล์นี้ re-export ให้ครบเพื่อไม่ต้องแก้ import ของ API route เดิมราว 70 เส้น
export {
    ROLES,
    ROLE_RANK,
    ROLE_LABELS,
    STAFF_ROLES,
    MANAGER_ROLES,
    ADMIN_ROLES,
    rolesAtLeast,
    parseRoles,
    hasRole,
    isAtLeast,
    isStaff,
    isManager,
    isAdmin,
} from "@/lib/roles"
export type { Role } from "@/lib/roles"

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
