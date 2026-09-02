// lib/notification-schema.ts
// Schema ตรวจความถูกต้องของ payload ในกลุ่มการแจ้งเตือน (NFR2)
//   api/notifications · api/notifications/[id] · api/notifications/preferences · api/notifications/retry
// อ้างอิง docs/spec.md §8 ⑧ (F8.2, F8.7, F8.8)

import { z } from "zod"
import { NOTIFICATION_CHANNELS } from "@/lib/notification-templates"

export const listNotificationsQuerySchema = z.object({
    /// unread = เฉพาะที่ยังไม่อ่าน · all = ทั้งหมด
    state: z.enum(["unread", "all"]).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
})
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>

/// ทำเครื่องหมายอ่าน/ยังไม่อ่านรายการเดียว (F8.2)
export const updateNotificationSchema = z.object({
    isRead: z.boolean({ message: "ค่าต้องเป็น true หรือ false" }),
})
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>

/// ตั้งค่าเปิด/ปิดช่องทางรายบุคคล (F8.7) — ส่งมาเฉพาะช่องที่ต้องการเปลี่ยนได้
export const updatePreferencesSchema = z
    .object({
        inapp: z.boolean().optional(),
        email: z.boolean().optional(),
        line: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "ไม่มีข้อมูลที่ต้องการบันทึก" })
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>

/// สั่งส่งซ้ำรายการที่ล้มเหลว (F8.8) — จำกัดจำนวนต่อครั้งกันยิงเมลรัวเกินไป
export const retryDeliveriesSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
})
export type RetryDeliveriesInput = z.infer<typeof retryDeliveriesSchema>

export { NOTIFICATION_CHANNELS }
