// lib/ticket-notify.ts
// "เหตุการณ์ไหนแจ้งใคร" ของงาน Helpdesk (F8.6)
//
// แยกออกจาก `lib/notification.ts` (ที่ทำหน้าที่ *ส่ง*) เพราะกฎว่าใครควรได้รับแจ้งเป็นเรื่องของ
// ธุรกิจ ไม่ใช่เรื่องของช่องทาง — และ route ของ Ticket จะได้เรียกบรรทัดเดียวจบ
//
// ทุกฟังก์ชันในไฟล์นี้กลืน error ไว้เอง (ผ่าน notify/notifyMany) และ **ไม่ควร await**
// ในเส้นทางที่ผู้ใช้รออยู่ ถ้าไม่จำเป็น — ดูหมายเหตุท้ายไฟล์

import { PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { notify, notifyLineGroup, notifyMany } from "@/lib/notification"
import {
    ticketAssigned,
    ticketCommented,
    ticketCreated,
    ticketResolved,
    ticketStatusChanged,
} from "@/lib/notification-templates"

/// ข้อมูล Ticket เท่าที่การแจ้งเตือนต้องใช้ — รับได้ทั้งจาก `ticketListSelect` และ `ticketDetailSelect`
export interface NotifyTicket {
    id: string
    ticketNo: string
    title: string
    priority: string
    resolutionDueAt: Date | null
    requester: { id: string; name: string }
    assignee: { id: string; name: string } | null
    category: { name: string }
}

function priorityLabelOf(priority: string): string {
    return PRIORITY_LABEL[priority as Priority] ?? priority
}

/// วันครบกำหนดแบบไทยสำหรับใส่ในข้อความ
function dueLabelOf(due: Date | null): string {
    if (!due) return "ไม่ได้กำหนด"
    return due.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/// Ticket ใหม่เข้าระบบ (F8.6)
///
/// - เจ้าหน้าที่ที่ระบบมอบหมายให้อัตโนมัติ → แจ้งรายบุคคล
/// - กลุ่ม LINE ของทีม → ประกาศทุกใบ เพื่อให้ทีมเห็นงานที่ยังไม่มีคนรับด้วย (F8.4)
export async function notifyTicketCreated(ticket: NotifyTicket, actorId: string): Promise<void> {
    const content = ticketCreated(ticket, {
        requesterName: ticket.requester.name,
        categoryName: ticket.category.name,
        priorityLabel: priorityLabelOf(ticket.priority),
    })

    await Promise.all([
        ticket.assignee
            ? notify({ ...content, userId: ticket.assignee.id, skipIfActor: actorId })
            : Promise.resolve(null),
        notifyLineGroup(content),
    ])
}

/// มอบหมาย / โยกย้ายงาน — แจ้งผู้รับงานคนใหม่ (ไม่แจ้งถ้าเขาเป็นคนกดเอง)
export async function notifyTicketAssigned(
    ticket: NotifyTicket,
    actorId: string,
    actorName: string
): Promise<void> {
    if (!ticket.assignee) return

    await notify({
        ...ticketAssigned(ticket, {
            actorName,
            priorityLabel: priorityLabelOf(ticket.priority),
            dueLabel: dueLabelOf(ticket.resolutionDueAt),
        }),
        userId: ticket.assignee.id,
        skipIfActor: actorId,
    })
}

/// สถานะเปลี่ยน — ผู้แจ้งต้องรู้ความคืบหน้าเสมอ · ผู้รับผิดชอบรู้ด้วยเมื่อคนอื่นเป็นคนเปลี่ยน
///
/// สถานะ `resolved` ใช้ข้อความคนละแบบเพราะมีสรุปการแก้ไขให้อ่าน
export async function notifyTicketStatusChanged(
    ticket: NotifyTicket,
    detail: {
        fromLabel: string
        toLabel: string
        actorId: string
        actorName: string
        resolutionNote?: string | null
    }
): Promise<void> {
    const content =
        detail.resolutionNote != null
            ? ticketResolved(ticket, {
                  actorName: detail.actorName,
                  resolutionNote: detail.resolutionNote,
              })
            : ticketStatusChanged(ticket, {
                  fromLabel: detail.fromLabel,
                  toLabel: detail.toLabel,
                  actorName: detail.actorName,
              })

    await notifyMany([ticket.requester.id, ticket.assignee?.id], content, {
        skipIfActor: detail.actorId,
    })
}

/// ความคิดเห็นใหม่
///
/// `isInternal` = บันทึกภายใน ผู้แจ้งไม่เห็นข้อความนี้ในหน้าจอ จึงต้องไม่ส่งแจ้งเตือนให้ด้วย
/// ไม่งั้นเนื้อความภายในจะรั่วออกไปทางอีเมล/LINE
export async function notifyTicketCommented(
    ticket: NotifyTicket,
    detail: { authorId: string; authorName: string; body: string; isInternal: boolean }
): Promise<void> {
    const content = ticketCommented(ticket, {
        authorName: detail.authorName,
        body: detail.body,
    })

    const recipients = detail.isInternal
        ? [ticket.assignee?.id]
        : [ticket.requester.id, ticket.assignee?.id]

    await notifyMany(recipients, content, { skipIfActor: detail.authorId })
}

// หมายเหตุการใช้งาน
// ─────────────────
// route ของ Ticket เรียกฟังก์ชันเหล่านี้แบบ "ยิงแล้วไม่รอ" (ไม่ใส่ await) เพราะการส่งอีเมล
// และ LINE ใช้เวลาเป็นวินาที ผู้ใช้ไม่ควรต้องรอหน้าจอค้างเพื่อให้เมลออก
// ทุกฟังก์ชันจับ error ไว้ครบแล้ว จึงไม่มี unhandled rejection หลุดออกไป
