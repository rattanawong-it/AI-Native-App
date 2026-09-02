// lib/approval-notify.ts
// "เหตุการณ์ไหนแจ้งใคร" ของคำขออนุมัติ (F7.10, F7.12, F8.6)
//
// ยึดกติกาเดียวกับ `lib/ticket-notify.ts` และ `lib/task-notify.ts`:
// ทุกฟังก์ชันกลืน error ไว้เอง (ผ่าน notify) และ route เรียกแบบ "ยิงแล้วไม่รอ"
// เพื่อไม่ให้ผู้ขอต้องรออีเมล/LINE ออกก่อนหน้าจอจะตอบกลับ

import { notify } from "@/lib/notification"
import { approvalDecided, approvalRequested } from "@/lib/notification-templates"
import { APPROVAL_TYPE_LABEL, isApprovalType } from "@/lib/approval-workflow"

/// ข้อมูลคำขอเท่าที่การแจ้งเตือนต้องใช้ — รับได้จาก `approvalListSelect` และ `approvalDetailSelect`
export interface NotifyApproval {
    id: string
    requestNo: string
    title: string
    type: string
    requesterId: string
    requester?: { name: string } | null
}

function typeLabelOf(type: string): string {
    return isApprovalType(type) ? APPROVAL_TYPE_LABEL[type] : type
}

/// ถึงคิวผู้อนุมัติขั้นหนึ่ง — เรียกทั้งตอนยื่นคำขอครั้งแรก และตอนขั้นก่อนหน้าผ่าน (F7.10)
///
/// ไม่ส่งเมื่อผู้อนุมัติคือคนที่เพิ่งกดเอง (เช่นผู้ขอเป็นผู้อนุมัติขั้นแรกของตัวเอง) —
/// `notify` จะข้ามให้ผ่าน `skipIfActor`
export async function notifyApprovalPending(
    request: NotifyApproval,
    detail: {
        approverId: string
        stepOrder: number
        totalSteps: number
        amount: number | null
        actorId: string
    }
): Promise<void> {
    await notify({
        ...approvalRequested(request, {
            requesterName: request.requester?.name ?? "ไม่ทราบชื่อ",
            typeLabel: typeLabelOf(request.type),
            amount: detail.amount,
            stepOrder: detail.stepOrder,
            totalSteps: detail.totalSteps,
        }),
        userId: detail.approverId,
        skipIfActor: detail.actorId,
    })
}

/// คำขอได้ข้อยุติ — แจ้งผู้ขอว่าอนุมัติครบทุกขั้นแล้ว หรือถูกตีตก (F7.11, F7.12)
export async function notifyApprovalDecided(
    request: NotifyApproval,
    detail: {
        approved: boolean
        approverName: string
        comment: string | null
        actorId: string
    }
): Promise<void> {
    await notify({
        ...approvalDecided(request, {
            approved: detail.approved,
            approverName: detail.approverName,
            comment: detail.comment,
        }),
        userId: request.requesterId,
        skipIfActor: detail.actorId,
    })
}
