// lib/notification.ts
// Service กลางของการแจ้งเตือน (F8.1)
//
//   notify({ userId, ...content, channels })  → แจ้งผู้ใช้หนึ่งคน
//   notifyMany([...userIds], content)         → แจ้งหลายคนพร้อมกัน
//   notifyLineGroup(content)                  → ประกาศเข้ากลุ่ม LINE ของทีม (F8.4)
//
// หลักการสำคัญสองข้อ:
//
//  1. **การแจ้งเตือนต้องไม่ทำให้งานหลักล้มเหลว** — ทุกฟังก์ชันในไฟล์นี้กลืน error ไว้เอง
//     ผู้เรียก (route ของ Ticket) จึงเรียกได้โดยไม่ต้อง try/catch และไม่ต้องรอ
//     ถ้าส่งเมลไม่ผ่าน ผู้ใช้ยังต้องได้ Ticket ของตัวเองตามปกติ
//
//  2. **บันทึกผลส่งทุกช่องทาง** ลง `NotificationDelivery` (F8.8) เพื่อให้ตามได้ว่า
//     ช่องไหนส่งไม่ผ่านเพราะอะไร และสั่งส่งซ้ำได้ภายหลัง
//
// อ้างอิง docs/spec.md §8 ⑧

import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/mailer"
import { pushMessageTo, pushMessageToGroup } from "@/lib/line-push"
import {
    NOTIFICATION_CHANNELS,
    emailHtml,
    emailSubject,
    lineText,
    type NotificationChannel,
    type NotificationContent,
} from "@/lib/notification-templates"

/// ช่องทางที่เปิดใช้งานเป็นค่าเริ่มต้นเมื่อผู้ใช้ยังไม่เคยตั้งค่าเอง
const DEFAULT_PREFS: Record<NotificationChannel, boolean> = {
    inapp: true,
    email: true,
    line: true,
}

// ── ตั้งค่ารายบุคคล (F8.7) ───────────────────────────────────────────
//
// เก็บใน `AppSetting` ด้วยคีย์ `notification.prefs.<userId>` แทนการเพิ่มตารางใหม่
// เพราะเป็นค่าตั้งค่าล้วนๆ ที่อ่านทีละคน และเลี่ยงการทำ migration กับฐานข้อมูลจริง
// (ถ้าวันหนึ่งต้องคิวรีข้ามผู้ใช้จำนวนมาก ค่อยย้ายไปเป็นตารางของตัวเองในเฟสถัดไป)

export type NotificationPrefs = Record<NotificationChannel, boolean>

export function prefsKey(userId: string): string {
    return `notification.prefs.${userId}`
}

/// อ่านค่าที่บันทึกไว้ให้เป็นรูปแบบที่ใช้ได้เสมอ — ค่าที่ผิดชนิดจะถอยไปใช้ค่าเริ่มต้น
function normalizePrefs(raw: unknown): NotificationPrefs {
    const source = (raw ?? {}) as Record<string, unknown>
    const out = { ...DEFAULT_PREFS }
    for (const channel of NOTIFICATION_CHANNELS) {
        if (typeof source[channel] === "boolean") out[channel] = source[channel] as boolean
    }
    return out
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
    try {
        const row = await prisma.appSetting.findUnique({
            where: { key: prefsKey(userId) },
            select: { value: true },
        })
        return normalizePrefs(row?.value)
    } catch (error) {
        console.error("getNotificationPrefs Error:", error)
        return { ...DEFAULT_PREFS }
    }
}

/// อ่านค่าของหลายคนในคิวรีเดียว — ใช้ตอนแจ้งหลายคนพร้อมกัน
async function getPrefsMap(userIds: string[]): Promise<Map<string, NotificationPrefs>> {
    const map = new Map<string, NotificationPrefs>()
    if (userIds.length === 0) return map

    try {
        const rows = await prisma.appSetting.findMany({
            where: { key: { in: userIds.map(prefsKey) } },
            select: { key: true, value: true },
        })
        for (const row of rows) {
            map.set(row.key.replace("notification.prefs.", ""), normalizePrefs(row.value))
        }
    } catch (error) {
        console.error("getPrefsMap Error:", error)
    }

    for (const id of userIds) {
        if (!map.has(id)) map.set(id, { ...DEFAULT_PREFS })
    }
    return map
}

export async function saveNotificationPrefs(
    userId: string,
    prefs: Partial<NotificationPrefs>
): Promise<NotificationPrefs> {
    const current = await getNotificationPrefs(userId)
    const next = { ...current, ...prefs }

    await prisma.appSetting.upsert({
        where: { key: prefsKey(userId) },
        update: { value: next },
        create: {
            key: prefsKey(userId),
            value: next,
            description: "ช่องทางแจ้งเตือนที่ผู้ใช้รายนี้เปิดใช้งาน",
        },
    })

    return next
}

// ── การส่งจริงแต่ละช่องทาง ───────────────────────────────────────────

interface Recipient {
    id: string
    name: string
    email: string
    lineUserId: string | null
}

interface DeliveryResult {
    channel: NotificationChannel
    status: "sent" | "failed"
    error?: string
}

/// ส่งช่องทางเดียว — คืนผลเสมอ ไม่โยน error
async function deliver(
    channel: NotificationChannel,
    recipient: Recipient,
    content: NotificationContent
): Promise<DeliveryResult> {
    try {
        if (channel === "inapp") {
            // แถวใน `Notification` ถูกสร้างไปแล้วก่อนเรียกฟังก์ชันนี้ — ถือว่าถึงมือผู้รับทันที
            return { channel, status: "sent" }
        }

        if (channel === "email") {
            if (!recipient.email) return { channel, status: "failed", error: "ผู้รับไม่มีอีเมล" }
            const result = await sendMail({
                to: recipient.email,
                subject: emailSubject(content),
                html: emailHtml(content),
                text: `${content.title}\n\n${content.body}`,
            })
            return result.ok
                ? { channel, status: "sent" }
                : { channel, status: "failed", error: result.error }
        }

        // channel === "line"
        if (!recipient.lineUserId) {
            return { channel, status: "failed", error: "ผู้รับยังไม่ได้ผูกบัญชี LINE" }
        }
        // `pushMessageTo` แค่เขียน warning แล้วคืนค่าปกติเมื่อยังไม่ได้ตั้ง token —
        // ถ้าไม่ดักตรงนี้ จะบันทึกว่า "ส่งสำเร็จ" ทั้งที่ไม่มีอะไรถูกส่งออกไปเลย
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            return { channel, status: "failed", error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }
        }
        await pushMessageTo(recipient.lineUserId, lineText(content))
        return { channel, status: "sent" }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { channel, status: "failed", error: message.slice(0, 500) }
    }
}

/// บันทึกผลส่งลง `NotificationDelivery` (F8.8)
async function recordDeliveries(notificationId: string, results: DeliveryResult[]): Promise<void> {
    if (results.length === 0) return
    try {
        await prisma.notificationDelivery.createMany({
            data: results.map((r) => ({
                notificationId,
                channel: r.channel,
                status: r.status,
                error: r.error ?? null,
                sentAt: r.status === "sent" ? new Date() : null,
            })),
        })
    } catch (error) {
        console.error("recordDeliveries Error:", error)
    }
}

// ── API หลักของ service ──────────────────────────────────────────────

export interface NotifyInput extends NotificationContent {
    /// ผู้รับ — ถ้าเป็น id ที่ไม่มีในระบบจะถูกข้ามเงียบๆ
    userId: string
    /// จำกัดช่องทางเฉพาะที่ระบุ (ยังต้องผ่านการตั้งค่าของผู้ใช้อีกชั้น) · ไม่ระบุ = ทุกช่องทาง
    channels?: NotificationChannel[]
    /// ไม่ต้องแจ้งเมื่อผู้รับคือคนที่ทำรายการเอง — ส่ง id ของผู้ทำรายการมา
    skipIfActor?: string | null
}

/// แจ้งเตือนผู้ใช้หนึ่งคนครบทุกช่องทางที่เขาเปิดไว้
///
/// คืน id ของแถว `Notification` ที่สร้าง หรือ `null` เมื่อไม่ได้แจ้ง (ผู้รับไม่มีอยู่จริง /
/// เป็นคนทำรายการเอง / ปิดทุกช่องทาง)
export async function notify(input: NotifyInput): Promise<string | null> {
    try {
        if (input.skipIfActor && input.skipIfActor === input.userId) return null

        const recipient = await prisma.user.findUnique({
            where: { id: input.userId },
            select: { id: true, name: true, email: true, lineUserId: true },
        })
        if (!recipient) return null

        const prefs = await getNotificationPrefs(recipient.id)
        const requested = input.channels ?? [...NOTIFICATION_CHANNELS]
        const channels = requested.filter((c) => prefs[c])
        if (channels.length === 0) return null

        // สร้างแถวการแจ้งเตือนก่อนเสมอ แม้ผู้ใช้จะปิด in-app ไว้ —
        // เพราะ `NotificationDelivery` ต้องมีแถวแม่ให้อ้างถึง และเป็นบันทึกว่าเคยแจ้งอะไรไปบ้าง
        const created = await prisma.notification.create({
            data: {
                userId: recipient.id,
                type: input.type,
                title: input.title,
                body: input.body,
                linkUrl: input.linkUrl ?? null,
                // ปิด in-app ไว้ = ไม่ต้องขึ้นกระดิ่ง จึงทำเครื่องหมายว่าอ่านแล้วตั้งแต่ต้น
                isRead: !channels.includes("inapp"),
                readAt: channels.includes("inapp") ? null : new Date(),
            },
            select: { id: true },
        })

        const results = await Promise.all(
            channels.map((channel) => deliver(channel, recipient, input))
        )
        await recordDeliveries(created.id, results)

        return created.id
    } catch (error) {
        // การแจ้งเตือนพังต้องไม่ทำให้งานหลักพังตาม
        console.error("notify Error:", error)
        return null
    }
}

/// แจ้งหลายคนพร้อมกัน — ข้ามผู้รับที่ซ้ำและผู้ทำรายการเอง
export async function notifyMany(
    userIds: (string | null | undefined)[],
    content: NotificationContent,
    options: { channels?: NotificationChannel[]; skipIfActor?: string | null } = {}
): Promise<void> {
    const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))].filter(
        (id) => id !== options.skipIfActor
    )
    if (unique.length === 0) return

    try {
        // อ่านค่าตั้งค่าของทุกคนในคิวรีเดียว แล้วค่อยแยกส่ง
        await getPrefsMap(unique)
        await Promise.all(
            unique.map((userId) =>
                notify({ ...content, userId, channels: options.channels, skipIfActor: options.skipIfActor })
            )
        )
    } catch (error) {
        console.error("notifyMany Error:", error)
    }
}

/// ประกาศเข้ากลุ่ม LINE ของทีม (F8.4) — ไม่ผูกกับผู้ใช้คนใด จึงไม่สร้างแถว `Notification`
export async function notifyLineGroup(content: NotificationContent): Promise<void> {
    try {
        await pushMessageToGroup(lineText(content))
    } catch (error) {
        console.error("notifyLineGroup Error:", error)
    }
}

// ── ส่งซ้ำเมื่อล้มเหลว (F8.8) ────────────────────────────────────────

export interface RetryResult {
    attempted: number
    sent: number
    stillFailed: number
}

/// ลองส่งใหม่เฉพาะรายการที่สถานะเป็น `failed`
///
/// อัปเดตแถวเดิมแทนการสร้างแถวใหม่ เพื่อให้หนึ่งช่องทางของหนึ่งการแจ้งเตือนมีผลลัพธ์เดียว
/// `maxItems` กันไม่ให้การกดปุ่มครั้งเดียวยิงเมลเป็นพันฉบับ
export async function retryFailedDeliveries(maxItems = 50): Promise<RetryResult> {
    const failed = await prisma.notificationDelivery.findMany({
        where: { status: "failed", channel: { in: ["email", "line"] } },
        orderBy: { createdAt: "asc" },
        take: maxItems,
        select: {
            id: true,
            channel: true,
            notification: {
                select: {
                    type: true,
                    title: true,
                    body: true,
                    linkUrl: true,
                    user: { select: { id: true, name: true, email: true, lineUserId: true } },
                },
            },
        },
    })

    let sent = 0
    for (const row of failed) {
        const content: NotificationContent = {
            type: row.notification.type as NotificationContent["type"],
            title: row.notification.title,
            body: row.notification.body,
            linkUrl: row.notification.linkUrl,
        }
        const result = await deliver(
            row.channel as NotificationChannel,
            row.notification.user,
            content
        )

        await prisma.notificationDelivery.update({
            where: { id: row.id },
            data: {
                status: result.status,
                error: result.error ?? null,
                sentAt: result.status === "sent" ? new Date() : null,
            },
        })
        if (result.status === "sent") sent += 1
    }

    return { attempted: failed.length, sent, stillFailed: failed.length - sent }
}
