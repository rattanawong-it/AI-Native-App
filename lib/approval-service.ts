// lib/approval-service.ts
// Helper กลางของคำขออนุมัติ — select shape, สิทธิ์ระดับแถว, ตัวกรอง, timeline
// อ้างอิง docs/spec.md §5.6 (ApprovalRequest, ApprovalStep) และ §8 ⑦B (F7.8–F7.14)

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { AuthUser, isAtLeast, isManager, parseRoles } from "@/lib/rbac"
import {
    APPROVAL_STATUS_LABEL,
    APPROVAL_STEP_STATUS_LABEL,
    APPROVAL_TYPE_LABEL,
    isApprovalStatus,
    isApprovalType,
    isEditable,
    type ApprovalStepStatus,
} from "@/lib/approval-workflow"
import type { ListApprovalQuery } from "@/lib/approval-schema"

// ── Select shape ─────────────────────────────────────────────────────

const personSelect = { select: { id: true, name: true, email: true } }

export const approvalStepSelect = {
    id: true,
    stepOrder: true,
    approverId: true,
    status: true,
    comment: true,
    decidedAt: true,
    createdAt: true,
    approver: personSelect,
} satisfies Prisma.ApprovalStepSelect

export const approvalListSelect = {
    id: true,
    requestNo: true,
    type: true,
    title: true,
    amount: true,
    status: true,
    currentStep: true,
    requesterId: true,
    createdAt: true,
    updatedAt: true,
    requester: personSelect,
    steps: { select: approvalStepSelect, orderBy: { stepOrder: "asc" } },
} satisfies Prisma.ApprovalRequestSelect

export const approvalDetailSelect = {
    ...approvalListSelect,
    description: true,
    attachments: {
        select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
        },
    },
} satisfies Prisma.ApprovalRequestSelect

export type ApprovalStepRow = Prisma.ApprovalStepGetPayload<{ select: typeof approvalStepSelect }>
export type ApprovalListRow = Prisma.ApprovalRequestGetPayload<{
    select: typeof approvalListSelect
}>
export type ApprovalDetailRow = Prisma.ApprovalRequestGetPayload<{
    select: typeof approvalDetailSelect
}>

// ── แปลงค่าก่อนส่งออก JSON ──────────────────────────────────────────

/// Decimal ของ Prisma ผ่าน JSON.stringify แล้วได้ object ไม่ใช่ตัวเลข จึงต้องแปลงเองทุกครั้ง
/// null ต้องคงเป็น null — "ไม่ระบุวงเงิน" กับ "วงเงิน 0 บาท" คนละความหมายกัน
export function decimalOrNull(value: Prisma.Decimal | number | string | null): number | null {
    if (value === null) return null
    const n = typeof value === "number" ? value : Number(value.toString())
    return Number.isFinite(n) ? n : null
}

function toStepDto(step: ApprovalStepRow) {
    return {
        ...step,
        decidedAt: step.decidedAt?.toISOString() ?? null,
        createdAt: step.createdAt.toISOString(),
        statusLabel:
            APPROVAL_STEP_STATUS_LABEL[step.status as ApprovalStepStatus] ?? step.status,
    }
}

export function toApprovalDto(row: ApprovalListRow | ApprovalDetailRow) {
    return {
        ...row,
        amount: decimalOrNull(row.amount),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        steps: row.steps.map(toStepDto),
        statusLabel: isApprovalStatus(row.status) ? APPROVAL_STATUS_LABEL[row.status] : row.status,
        typeLabel: isApprovalType(row.type) ? APPROVAL_TYPE_LABEL[row.type] : row.type,
    }
}

// ── สิทธิ์ระดับแถว (NFR3, F7.12) ──────────────────────────────────────

/// เงื่อนไข where ที่จำกัดให้เห็นเฉพาะใบที่เกี่ยวข้องกับตัวเอง
/// `manager` ขึ้นไปมีสิทธิ์ `approval:read-all` จึงเห็นทุกใบ · ที่เหลือเห็นใบที่ตัวเองยื่น
/// หรือใบที่ตัวเองถูกกำหนดให้เป็นผู้อนุมัติขั้นใดขั้นหนึ่ง
export function approvalScopeWhere(user: AuthUser): Prisma.ApprovalRequestWhereInput {
    if (isManager(user)) return {}
    return {
        OR: [{ requesterId: user.id }, { steps: { some: { approverId: user.id } } }],
    }
}

/// อ่านใบนี้ได้ไหม (ตรวจซ้ำหลังดึงข้อมูลมาแล้ว)
export function canReadRequest(
    user: AuthUser,
    request: { requesterId: string; steps: { approverId: string }[] }
): boolean {
    if (isManager(user)) return true
    if (request.requesterId === user.id) return true
    return request.steps.some((s) => s.approverId === user.id)
}

/// แก้ไข / ลบใบนี้ได้ไหม — เจ้าของใบเท่านั้น และต้องยังไม่เข้าสู่การอนุมัติ (F7.11)
/// `admin` แก้ได้ทุกใบเพื่อกู้ข้อมูลที่กรอกผิด แต่ยังติดเงื่อนไขสถานะเหมือนกัน
export function canEditRequest(
    user: AuthUser,
    request: { requesterId: string; status: string }
): boolean {
    if (!isEditable(request.status)) return false
    return request.requesterId === user.id || user.roles.includes("admin")
}

/// ยกเลิกใบนี้ได้ไหม — เจ้าของใบยกเลิกได้ตราบใดที่ยังไม่จบกระบวนการ
export function canCancelRequest(
    user: AuthUser,
    request: { requesterId: string; status: string }
): boolean {
    if (request.status !== "draft" && request.status !== "pending") return false
    return request.requesterId === user.id || user.roles.includes("admin")
}

/// ตรวจว่าคนที่ถูกเลือกเป็นผู้อนุมัติมีตัวตนและมีสิทธิ์อนุมัติจริง (F7.10)
///
/// สิทธิ์ `approval:approve` เป็นของ `manager` ขึ้นไปตาม §7 — ถ้าปล่อยให้ตั้งใครก็ได้
/// คำขอจะไปค้างอยู่กับคนที่กดอนุมัติไม่ได้ คืนข้อความไทย หรือ `null` เมื่อผ่านทั้งชุด
export async function validateApprovers(approverIds: string[]): Promise<string | null> {
    const users = await prisma.user.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, name: true, role: true },
    })

    if (users.length !== approverIds.length) return "มีผู้อนุมัติบางคนที่ไม่พบในระบบ"

    const notAllowed = users.filter((u) => !isAtLeast({ roles: parseRoles(u.role) }, "manager"))
    if (notAllowed.length > 0) {
        return `${notAllowed.map((u) => u.name).join(", ")} ไม่มีสิทธิ์อนุมัติคำขอ`
    }

    return null
}

// ── ตัวกรองและการเรียงลำดับ (F7.8, F7.12) ─────────────────────────────

export function buildApprovalWhere(
    query: ListApprovalQuery,
    user: AuthUser
): Prisma.ApprovalRequestWhereInput {
    const and: Prisma.ApprovalRequestWhereInput[] = [approvalScopeWhere(user)]

    if (query.scope === "mine") and.push({ requesterId: user.id })
    if (query.scope === "to-approve") {
        // "รออนุมัติของฉัน" = ใบที่ยังเดินอยู่ และขั้นที่รออยู่ตอนนี้เป็นของเรา (F7.12)
        and.push({
            status: "pending",
            steps: { some: { approverId: user.id, status: "pending" } },
        })
    }

    if (query.status) and.push({ status: query.status })
    if (query.type) and.push({ type: query.type })
    if (query.requesterId) and.push({ requesterId: query.requesterId })

    if (query.q) {
        and.push({
            OR: [
                { requestNo: { contains: query.q, mode: "insensitive" } },
                { title: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
            ],
        })
    }

    const clauses = and.filter((c) => Object.keys(c).length > 0)
    if (clauses.length === 0) return {}
    return clauses.length === 1 ? clauses[0] : { AND: clauses }
}

export function buildApprovalOrderBy(
    sort: ListApprovalQuery["sort"]
): Prisma.ApprovalRequestOrderByWithRelationInput[] {
    switch (sort) {
        case "amount":
            return [{ amount: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        case "status":
            return [{ status: "asc" }, { createdAt: "desc" }]
        default:
            return [{ createdAt: "desc" }]
    }
}

/// ใบที่ "รออนุมัติของฉัน" — ใช้นับตัวเลขขึ้นป้ายบนเมนู โดยไม่ต้องดึงรายการทั้งชุด
export function pendingForApproverWhere(userId: string): Prisma.ApprovalRequestWhereInput {
    return {
        status: "pending",
        steps: { some: { approverId: userId, status: "pending" } },
    }
}

// ── Timeline การอนุมัติ (F7.14) ───────────────────────────────────────

export interface TimelineEntry {
    /// ลำดับเหตุการณ์ตามเวลาจริง
    at: string
    kind: "created" | "submitted" | "approved" | "rejected" | "closed"
    title: string
    actorName: string | null
    comment: string | null
}

/// ประกอบเหตุการณ์ของใบคำขอเป็นเส้นเวลาเดียว
///
/// ระบบไม่ได้เก็บตาราง activity แยกเหมือน Ticket — เหตุการณ์ทั้งหมดอนุมานได้จาก
/// วันที่สร้างใบ + `decidedAt` ของแต่ละขั้น ซึ่งเพียงพอกับรูปแบบการอนุมัติแบบไล่ขั้น
export function buildTimeline(request: ApprovalListRow | ApprovalDetailRow): TimelineEntry[] {
    const entries: TimelineEntry[] = [
        {
            at: request.createdAt.toISOString(),
            kind: "created",
            title: "สร้างคำขอ",
            actorName: request.requester?.name ?? null,
            comment: null,
        },
    ]

    if (request.status !== "draft") {
        entries.push({
            at: request.createdAt.toISOString(),
            kind: "submitted",
            title: "ยื่นคำขอเข้าสู่การอนุมัติ",
            actorName: request.requester?.name ?? null,
            comment: null,
        })
    }

    for (const step of request.steps) {
        if (!step.decidedAt) continue
        entries.push({
            at: step.decidedAt.toISOString(),
            kind: step.status === "approved" ? "approved" : "rejected",
            title:
                step.status === "approved"
                    ? `อนุมัติขั้นที่ ${step.stepOrder}`
                    : `ไม่อนุมัติขั้นที่ ${step.stepOrder}`,
            actorName: step.approver?.name ?? null,
            comment: step.comment,
        })
    }

    if (request.status === "cancelled") {
        entries.push({
            at: request.updatedAt.toISOString(),
            kind: "closed",
            title: "ยกเลิกคำขอ",
            actorName: request.requester?.name ?? null,
            comment: null,
        })
    }

    return entries.sort((a, b) => a.at.localeCompare(b.at))
}
