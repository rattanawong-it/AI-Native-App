// lib/task-notify.ts
// "เหตุการณ์ไหนแจ้งใคร" ของงานพัฒนาบนกระดาน (F5.6, F8.6)
//
// แยกจาก `lib/ticket-notify.ts` เพราะเป็นคนละงาน แต่ยึดกติกาเดียวกัน:
// ทุกฟังก์ชันกลืน error ไว้เอง (ผ่าน notify) และ route เรียกแบบ "ยิงแล้วไม่รอ"
// เพื่อไม่ให้ผู้ใช้ต้องรออีเมล/LINE ออกก่อนหน้าจอจะตอบกลับ

import { PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { notify } from "@/lib/notification"
import { taskAssigned } from "@/lib/notification-templates"

/// ข้อมูล Task เท่าที่การแจ้งเตือนต้องใช้ — รับได้จาก `taskCardSelect` และ `taskDetailSelect`
export interface NotifyTask {
    id: string
    title: string
    projectId: string
    priority: string
    dueDate: Date | null
    assigneeId: string | null
}

function priorityLabelOf(priority: string): string {
    return PRIORITY_LABEL[priority as Priority] ?? priority
}

function dueLabelOf(due: Date | null): string {
    if (!due) return "ไม่ได้กำหนด"
    return due.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

/// Task ถูกมอบหมาย — แจ้งผู้รับงาน (ไม่แจ้งถ้าเขาเป็นคนกดเอง)
///
/// เรียกทั้งตอนสร้างการ์ดพร้อมผู้รับผิดชอบ และตอนเปลี่ยนผู้รับผิดชอบภายหลัง
export async function notifyTaskAssigned(
    task: NotifyTask,
    detail: {
        actorId: string
        actorName: string
        projectName: string
        sprintName: string | null
    }
): Promise<void> {
    if (!task.assigneeId) return

    await notify({
        ...taskAssigned(task, {
            actorName: detail.actorName,
            projectName: detail.projectName,
            priorityLabel: priorityLabelOf(task.priority),
            sprintLabel: detail.sprintName ?? "ยังไม่เข้ารอบ (Backlog)",
            dueLabel: dueLabelOf(task.dueDate),
        }),
        userId: task.assigneeId,
        skipIfActor: detail.actorId,
    })
}
