// lib/mailer.ts
// ส่งอีเมลของระบบแจ้งเตือน (F8.3)
//
// ใช้ตัวแปรสภาพแวดล้อมชุดเดียวกับที่ `lib/auth.ts` ใช้ส่งเมลยืนยันตัวตน (SMTP_HOST / SMTP_PORT /
// GMAIL_USER / GMAIL_APP_PASSWORD) แต่แยก transporter ของตัวเองไว้ที่นี่ เพื่อไม่ต้องแก้ `lib/auth.ts`
// ซึ่งอยู่ในตาราง M4 และเป็นหัวใจของการยืนยันตัวตน
//
// ทุกฟังก์ชันในไฟล์นี้ **ไม่โยน error ออกไป** — ผู้เรียกคือ notification service ที่ต้องบันทึกผลส่ง
// ลง `NotificationDelivery` เอง จึงคืนผลเป็นค่าแทนการ throw

import nodemailer from "nodemailer"

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465
const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

/// ชื่อผู้ส่งที่ผู้รับจะเห็นในกล่องจดหมาย
const FROM_NAME = "ศูนย์เทคโนโลยีสารสนเทศ"

/// ตั้งค่าครบหรือยัง — ถ้ายัง ระบบจะข้ามการส่งเมลแทนที่จะพัง
export function isMailerConfigured(): boolean {
    return Boolean(SMTP_HOST && GMAIL_USER && GMAIL_APP_PASSWORD)
}

/// สร้าง transporter ครั้งเดียวแล้วใช้ซ้ำ — nodemailer จัดการ connection pool ให้เอง
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
    if (!isMailerConfigured()) return null
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            // พอร์ต 465 เป็น SMTPS (เข้ารหัสตั้งแต่เริ่ม) · พอร์ตอื่นใช้ STARTTLS
            secure: SMTP_PORT === 465,
            auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        })
    }
    return transporter
}

export interface MailResult {
    ok: boolean
    /// ข้อความอธิบายเมื่อส่งไม่สำเร็จ — เก็บลง `NotificationDelivery.error`
    error?: string
}

/// ส่งอีเมลหนึ่งฉบับ — คืน `{ ok: false, error }` แทนการ throw
export async function sendMail(params: {
    to: string
    subject: string
    html: string
    /// ข้อความสำรองสำหรับโปรแกรมอ่านเมลที่ไม่แสดง HTML
    text?: string
}): Promise<MailResult> {
    const tx = getTransporter()
    if (!tx) {
        return { ok: false, error: "ยังไม่ได้ตั้งค่า SMTP (SMTP_HOST / GMAIL_USER / GMAIL_APP_PASSWORD)" }
    }

    try {
        await tx.sendMail({
            from: `"${FROM_NAME}" <${GMAIL_USER}>`,
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
        })
        return { ok: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("sendMail Error:", message)
        return { ok: false, error: message.slice(0, 500) }
    }
}
