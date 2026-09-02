// lib/notification-client-types.ts
// รูปร่างข้อมูลที่ API ของการแจ้งเตือนคืนกลับมา — ใช้ร่วมกันทุก client component
// ค่าวันที่เป็น string เพราะผ่าน JSON มาแล้ว
// อ้างอิง docs/spec.md §8 ⑧

import type { NotificationChannel, NotificationType } from "@/lib/notification-templates"

export interface NotificationRow {
    id: string
    type: string
    title: string
    body: string
    linkUrl: string | null
    isRead: boolean
    readAt: string | null
    createdAt: string
    /// สรุปผลการส่งแต่ละช่องทาง — ใช้บอกผู้ใช้ว่าเมล/LINE ส่งไม่ผ่าน
    deliveries: { channel: string; status: string; error: string | null }[]
}

export interface NotificationListResponse {
    notifications: NotificationRow[]
    unreadCount: number
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface NotificationPrefsResponse {
    prefs: Record<NotificationChannel, boolean>
    /// ผูกบัญชี LINE ไว้แล้วหรือยัง — ถ้ายัง ช่อง LINE จะแจ้งเตือนไม่ได้แม้เปิดสวิตช์
    lineLinked: boolean
}

/// ป้ายกำกับชนิดการแจ้งเตือนสำหรับแสดงบนกระดิ่ง
export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
    ticket_created: "Ticket ใหม่",
    ticket_assigned: "ได้รับมอบหมาย",
    ticket_status_changed: "สถานะเปลี่ยน",
    ticket_commented: "ความคิดเห็นใหม่",
    ticket_resolved: "แก้ไขเสร็จ",
    approval_requested: "คำขออนุมัติ",
    approval_decided: "ผลการอนุมัติ",
    task_assigned: "Task ใหม่",
}

export type { NotificationChannel, NotificationType }
