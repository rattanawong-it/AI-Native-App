// lib/approval-types.ts
// ชนิดข้อมูลฝั่ง client ของคำขออนุมัติ
// อ้างอิง docs/spec.md §5.6 และ §8 ⑦B
//
// แยกจาก `lib/approval-service.ts` เพราะไฟล์นั้น import prisma — client component นำเข้าไม่ได้

import type { ApprovalType } from "@/lib/approval-workflow"

export interface ApprovalPerson {
    id: string
    name: string
    email?: string
}

export interface ApprovalStepRow {
    id: string
    stepOrder: number
    approverId: string
    status: string
    statusLabel: string
    comment: string | null
    decidedAt: string | null
    createdAt: string
    approver: ApprovalPerson
}

export interface ApprovalRow {
    id: string
    requestNo: string
    type: string
    title: string
    amount: number | null
    status: string
    currentStep: number
    requesterId: string
    createdAt: string
    updatedAt: string
    requester: ApprovalPerson
    steps: ApprovalStepRow[]
    statusLabel: string
    typeLabel: string
}

export interface ApprovalAttachmentRow {
    id: string
    fileName: string
    fileType: string
    fileSize: number
    createdAt: string
}

export interface ApprovalDetail extends ApprovalRow {
    description: string | null
    attachments: ApprovalAttachmentRow[]
}

export interface TimelineEntry {
    at: string
    kind: "created" | "submitted" | "approved" | "rejected" | "closed"
    title: string
    actorName: string | null
    comment: string | null
}

export interface ApprovalListResponse {
    requests: ApprovalRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface ApprovalDetailResponse {
    request: ApprovalDetail
    timeline: TimelineEntry[]
    /// true = ผู้ใช้คนนี้คือผู้อนุมัติของขั้นที่รออยู่ → แสดงปุ่มอนุมัติ/ไม่อนุมัติ (F7.12)
    canDecide: boolean
    canEdit: boolean
}

export interface ApprovalPendingResponse {
    total: number
    requests?: ApprovalRow[]
}

export const APPROVAL_SORT_OPTIONS = [
    { key: "latest", label: "ยื่นล่าสุด" },
    { key: "amount", label: "วงเงินสูงสุด" },
    { key: "status", label: "ตามสถานะ" },
] as const

/// ฟอร์มสร้าง/แก้ไขคำขอ — `approverIds` เรียงตามลำดับขั้นที่จะไล่อนุมัติ (F7.10)
export interface ApprovalFormValues {
    type: ApprovalType
    title: string
    description: string
    amount: string
    approverIds: string[]
}

export const EMPTY_APPROVAL_FORM: ApprovalFormValues = {
    type: "purchase",
    title: "",
    description: "",
    amount: "",
    approverIds: [],
}

export function approvalFormToPayload(
    form: ApprovalFormValues,
    submit: boolean
): Record<string, unknown> {
    return {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() === "" ? null : form.description.trim(),
        amount: form.amount.trim() === "" ? null : form.amount.trim(),
        approverIds: form.approverIds,
        submit,
    }
}

export function approvalToForm(request: ApprovalDetail): ApprovalFormValues {
    return {
        type: request.type as ApprovalType,
        title: request.title,
        description: request.description ?? "",
        amount: request.amount === null ? "" : String(request.amount),
        approverIds: [...request.steps]
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((s) => s.approverId),
    }
}

/// จำนวนเงินแบบไทย — "12,500.00 บาท" หรือ "ไม่ระบุ" เมื่อคำขอไม่ผูกวงเงิน
export function formatAmount(amount: number | null): string {
    if (amount === null) return "ไม่ระบุ"
    return `${amount.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} บาท`
}
