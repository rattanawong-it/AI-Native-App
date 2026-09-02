// lib/notification-templates.ts
// ข้อความแจ้งเตือนของแต่ละเหตุการณ์ แยกตามช่องทาง (F8.3, F8.4, F8.6)
//
// เหตุผลที่แยกไฟล์: ข้อความที่ผู้ใช้เห็นเป็นสิ่งที่แก้บ่อยที่สุดในระบบแจ้งเตือน
// เก็บไว้ที่เดียวจะแก้ถ้อยคำได้โดยไม่ต้องแตะตรรกะการส่ง
//
// ทั้งสามช่องทางใช้ `title` + `body` ชุดเดียวกัน ต่างกันแค่การห่อ:
//   in-app → เก็บดิบลงตาราง · email → ห่อ HTML · LINE → ข้อความล้วนพร้อมอิโมจิ

/// เหตุการณ์ทั้งหมดที่ระบบแจ้งเตือนได้ — ตรงกับคอลัมน์ `Notification.type`
export const NOTIFICATION_TYPES = [
    "ticket_created",
    "ticket_assigned",
    "ticket_status_changed",
    "ticket_commented",
    "ticket_resolved",
    "approval_requested",
    "approval_decided",
    "task_assigned",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/// ช่องทางที่ส่งได้ — ตรงกับคอลัมน์ `NotificationDelivery.channel`
export const NOTIFICATION_CHANNELS = ["inapp", "email", "line"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
    inapp: "การแจ้งเตือนในระบบ",
    email: "อีเมล",
    line: "LINE",
}

/// ป้ายกำกับภาษาไทยของเหตุการณ์ — ใช้ในหน้าตั้งค่าและกระดิ่ง
export const TYPE_LABEL: Record<NotificationType, string> = {
    ticket_created: "มี Ticket ใหม่",
    ticket_assigned: "ได้รับมอบหมายงาน",
    ticket_status_changed: "สถานะงานเปลี่ยน",
    ticket_commented: "มีความคิดเห็นใหม่",
    ticket_resolved: "งานได้รับการแก้ไขแล้ว",
    approval_requested: "มีคำขอรออนุมัติ",
    approval_decided: "ผลการอนุมัติ",
    task_assigned: "ได้รับมอบหมาย Task",
}

/// อิโมจินำหน้าข้อความ LINE — ช่วยให้อ่านในกลุ่มที่ข้อความเยอะได้เร็วขึ้น
const TYPE_EMOJI: Record<NotificationType, string> = {
    ticket_created: "🆕",
    ticket_assigned: "📌",
    ticket_status_changed: "🔄",
    ticket_commented: "💬",
    ticket_resolved: "✅",
    approval_requested: "📝",
    approval_decided: "⚖️",
    task_assigned: "📋",
}

// ── ที่อยู่ของแอปสำหรับประกอบลิงก์ ───────────────────────────────────

/// URL ฐานของแอป — ใช้ตัวแปรเดิมที่ Better Auth ใช้อยู่แล้ว จึงไม่ต้องเพิ่ม env ใหม่ (M13)
export function appBaseUrl(): string {
    return (
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
        process.env.BETTER_AUTH_URL ||
        "http://localhost:3000"
    ).replace(/\/+$/, "")
}

/// เติม origin ให้ลิงก์ในระบบ — `/service/tickets/x` → `https://.../service/tickets/x`
export function absoluteUrl(path: string | null | undefined): string | null {
    if (!path) return null
    if (/^https?:\/\//i.test(path)) return path
    return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

// ── การห่อข้อความแต่ละช่องทาง ────────────────────────────────────────

export interface NotificationContent {
    type: NotificationType
    title: string
    body: string
    linkUrl?: string | null
}

/// หัวเรื่องอีเมล — ใส่ชื่อระบบนำหน้าให้แยกออกจากเมลอื่นในกล่องจดหมาย
export function emailSubject(content: NotificationContent): string {
    return `[ศูนย์ไอที] ${content.title}`
}

/// เนื้ออีเมล HTML — เขียน inline style ทั้งหมดเพราะโปรแกรมอ่านเมลส่วนใหญ่ตัด <style> ทิ้ง
export function emailHtml(content: NotificationContent): string {
    const link = absoluteUrl(content.linkUrl)
    const button = link
        ? `<p style="margin:24px 0 0;">
             <a href="${escapeHtml(link)}"
                style="display:inline-block;background:#3d4f9f;color:#ffffff;text-decoration:none;
                       padding:10px 20px;border-radius:6px;font-size:14px;">เปิดดูในระบบ</a>
           </p>`
        : ""

    return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2430;">
  <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">${escapeHtml(TYPE_LABEL[content.type])}</p>
  <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;">${escapeHtml(content.title)}</h1>
  <p style="margin:0;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(content.body)}</p>
  ${button}
  <hr style="margin:28px 0 12px;border:none;border-top:1px solid #e5e7eb;" />
  <p style="margin:0;font-size:12px;color:#9ca3af;">
    อีเมลฉบับนี้ส่งอัตโนมัติจากระบบบริการเทคโนโลยีสารสนเทศ กรุณาอย่าตอบกลับ<br />
    ปิดการแจ้งเตือนทางอีเมลได้ที่หน้าโปรไฟล์ของคุณ
  </p>
</div>`
}

/// ข้อความ LINE — ข้อความล้วน ไม่มี HTML · ใส่ลิงก์ท้ายสุดให้กดได้จากแอป
export function lineText(content: NotificationContent): string {
    const link = absoluteUrl(content.linkUrl)
    const lines = [`${TYPE_EMOJI[content.type]} ${content.title}`, "", content.body]
    if (link) lines.push("", link)
    return lines.join("\n")
}

/// หนีอักขระพิเศษก่อนวางลงเทมเพลต HTML — เนื้อหามาจากผู้ใช้ (หัวข้อ Ticket, ความคิดเห็น)
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

// ── ตัวช่วยประกอบข้อความของเหตุการณ์ Ticket (F8.6) ───────────────────

interface TicketBrief {
    id: string
    ticketNo: string
    title: string
}

export function ticketLink(ticket: TicketBrief): string {
    return `/service/tickets/${ticket.id}`
}

/// Ticket ใหม่เข้าระบบ — แจ้งเจ้าหน้าที่ที่รับผิดชอบและกลุ่ม LINE
export function ticketCreated(
    ticket: TicketBrief,
    extra: { requesterName: string; categoryName: string; priorityLabel: string }
): NotificationContent {
    return {
        type: "ticket_created",
        title: `${ticket.ticketNo} · ${ticket.title}`,
        body: [
            `ผู้แจ้ง: ${extra.requesterName}`,
            `หมวดหมู่: ${extra.categoryName}`,
            `ระดับความสำคัญ: ${extra.priorityLabel}`,
        ].join("\n"),
        linkUrl: ticketLink(ticket),
    }
}

/// งานถูกมอบหมายให้เจ้าหน้าที่คนหนึ่ง
export function ticketAssigned(
    ticket: TicketBrief,
    extra: { actorName: string; priorityLabel: string; dueLabel: string }
): NotificationContent {
    return {
        type: "ticket_assigned",
        title: `คุณได้รับมอบหมาย ${ticket.ticketNo}`,
        body: [
            ticket.title,
            "",
            `มอบหมายโดย: ${extra.actorName}`,
            `ระดับความสำคัญ: ${extra.priorityLabel}`,
            `กำหนดแก้ไข: ${extra.dueLabel}`,
        ].join("\n"),
        linkUrl: ticketLink(ticket),
    }
}

/// สถานะเปลี่ยน — แจ้งผู้แจ้งให้รู้ความคืบหน้า
export function ticketStatusChanged(
    ticket: TicketBrief,
    extra: { fromLabel: string; toLabel: string; actorName: string }
): NotificationContent {
    return {
        type: "ticket_status_changed",
        title: `${ticket.ticketNo} เปลี่ยนเป็น "${extra.toLabel}"`,
        body: [
            ticket.title,
            "",
            `จาก "${extra.fromLabel}" เป็น "${extra.toLabel}"`,
            `โดย: ${extra.actorName}`,
        ].join("\n"),
        linkUrl: ticketLink(ticket),
    }
}

/// แก้ไขเสร็จ — ข้อความต่างจากการเปลี่ยนสถานะทั่วไปเพราะมีสรุปการแก้ไขให้อ่าน
export function ticketResolved(
    ticket: TicketBrief,
    extra: { actorName: string; resolutionNote: string }
): NotificationContent {
    return {
        type: "ticket_resolved",
        title: `${ticket.ticketNo} แก้ไขเสร็จแล้ว`,
        body: [
            ticket.title,
            "",
            `สรุปการแก้ไข: ${extra.resolutionNote}`,
            `โดย: ${extra.actorName}`,
        ].join("\n"),
        linkUrl: ticketLink(ticket),
    }
}

/// มีความคิดเห็นใหม่ — ตัดข้อความยาวให้พอดีการแจ้งเตือน
export function ticketCommented(
    ticket: TicketBrief,
    extra: { authorName: string; body: string }
): NotificationContent {
    const snippet = extra.body.length > 300 ? `${extra.body.slice(0, 300)}…` : extra.body
    return {
        type: "ticket_commented",
        title: `${ticket.ticketNo} มีความคิดเห็นใหม่`,
        body: [`${extra.authorName}: ${snippet}`].join("\n"),
        linkUrl: ticketLink(ticket),
    }
}

// ── ตัวช่วยประกอบข้อความของเหตุการณ์ Task (F5.6, F8.6) ────────────────

interface TaskBrief {
    id: string
    title: string
    projectId: string
}

/// การ์ดบนกระดานไม่มีหน้าของตัวเอง — เปิดกระดานของโครงการแล้วให้หน้าจอกางการ์ดนั้นให้
export function taskLink(task: TaskBrief): string {
    return `/management/projects/${task.projectId}?task=${task.id}`
}

/// Task ถูกมอบหมายให้ผู้พัฒนาคนหนึ่ง (F5.6)
export function taskAssigned(
    task: TaskBrief,
    extra: {
        actorName: string
        projectName: string
        priorityLabel: string
        sprintLabel: string
        dueLabel: string
    }
): NotificationContent {
    return {
        type: "task_assigned",
        title: `คุณได้รับมอบหมาย Task ในโครงการ ${extra.projectName}`,
        body: [
            task.title,
            "",
            `มอบหมายโดย: ${extra.actorName}`,
            `รอบพัฒนา: ${extra.sprintLabel}`,
            `ระดับความสำคัญ: ${extra.priorityLabel}`,
            `กำหนดส่ง: ${extra.dueLabel}`,
        ].join("\n"),
        linkUrl: taskLink(task),
    }
}
