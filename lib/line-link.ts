// lib/line-link.ts
// ผูกบัญชีในระบบเข้ากับบัญชี LINE ของผู้ใช้ (F8.5 · เป็นเงื่อนไขของ F1.9 ด้วย)
//
// ทำไมต้องมีรหัสผูกบัญชี — ไม่ให้ผู้ใช้พิมพ์อีเมลของคนอื่นใน LINE แล้วสวมสิทธิ์ได้
// ขั้นตอนคือ ผู้ใช้ที่ล็อกอินอยู่แล้วกดขอรหัสในหน้าโปรไฟล์ → พิมพ์รหัสนั้นคุยกับบอทใน LINE
// → webhook จับคู่รหัสกับ `userId` ที่ออกรหัสให้ แล้วบันทึก `lineUserId`
//
// รหัสเก็บใน `AppSetting` คีย์ `line.bind.<code>` — ใช้ครั้งเดียวและหมดอายุใน 10 นาที
// จึงไม่ต้องเพิ่มตารางใหม่ (เลี่ยง migration กับฐานข้อมูลจริงตาม §16.5 ข้อ 3)

import { prisma } from "@/lib/prisma"

/// อายุของรหัสผูกบัญชี — สั้นพอที่รหัสหลุดไปก็ใช้ไม่ทัน
const CODE_TTL_MS = 10 * 60 * 1000

/// ไม่ใช้ 0 O 1 I L เพราะอ่านผิดง่ายเวลาพิมพ์ตามจากหน้าจอ
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
const CODE_LENGTH = 6

export function bindKey(code: string): string {
    return `line.bind.${code.toUpperCase()}`
}

function randomCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
    return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")
}

export interface BindCode {
    code: string
    expiresAt: string
}

/// ออกรหัสใหม่ให้ผู้ใช้หนึ่งคน — ล้างรหัสเก่าของคนเดียวกันทิ้งก่อน กันรหัสค้างหลายใบ
export async function issueBindCode(userId: string): Promise<BindCode> {
    await clearCodesOf(userId)

    const code = randomCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)

    await prisma.appSetting.upsert({
        where: { key: bindKey(code) },
        update: { value: { userId, expiresAt: expiresAt.toISOString() } },
        create: {
            key: bindKey(code),
            value: { userId, expiresAt: expiresAt.toISOString() },
            description: "รหัสผูกบัญชี LINE (ใช้ครั้งเดียว)",
        },
    })

    return { code, expiresAt: expiresAt.toISOString() }
}

/// ลบรหัสที่ยังค้างของผู้ใช้คนหนึ่ง
async function clearCodesOf(userId: string): Promise<void> {
    const rows = await prisma.appSetting.findMany({
        where: { key: { startsWith: "line.bind." } },
        select: { key: true, value: true },
    })
    const mine = rows
        .filter((r) => (r.value as { userId?: string } | null)?.userId === userId)
        .map((r) => r.key)
    if (mine.length > 0) {
        await prisma.appSetting.deleteMany({ where: { key: { in: mine } } })
    }
}

export type RedeemResult =
    | { ok: true; userName: string }
    | { ok: false; reason: "not_found" | "expired" | "already_linked" | "user_missing" }

/// ใช้รหัสผูกบัญชี — เรียกจาก webhook ของ LINE เท่านั้น
///
/// `lineUserId` เป็น unique ในตาราง User — ถ้าบัญชี LINE นี้ผูกกับคนอื่นไว้แล้ว จะตอบ `already_linked`
/// แทนการแย่งสิทธิ์ ผู้ใช้ต้องไปยกเลิกการผูกจากบัญชีเดิมก่อน
export async function redeemBindCode(code: string, lineUserId: string): Promise<RedeemResult> {
    const row = await prisma.appSetting.findUnique({
        where: { key: bindKey(code) },
        select: { key: true, value: true },
    })
    if (!row) return { ok: false, reason: "not_found" }

    const payload = row.value as { userId?: string; expiresAt?: string } | null
    const userId = payload?.userId
    const expiresAt = payload?.expiresAt ? Date.parse(payload.expiresAt) : 0

    if (!userId) {
        await prisma.appSetting.delete({ where: { key: row.key } }).catch(() => {})
        return { ok: false, reason: "not_found" }
    }

    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        await prisma.appSetting.delete({ where: { key: row.key } }).catch(() => {})
        return { ok: false, reason: "expired" }
    }

    const owner = await prisma.user.findFirst({
        where: { lineUserId },
        select: { id: true },
    })
    if (owner && owner.id !== userId) return { ok: false, reason: "already_linked" }

    const user = await prisma.user
        .update({
            where: { id: userId },
            data: { lineUserId },
            select: { name: true },
        })
        .catch(() => null)

    if (!user) return { ok: false, reason: "user_missing" }

    // รหัสใช้ครั้งเดียว — ลบทิ้งทันทีที่ผูกสำเร็จ
    await prisma.appSetting.delete({ where: { key: row.key } }).catch(() => {})
    return { ok: true, userName: user.name }
}

/// ยกเลิกการผูก — ผู้ใช้กดจากหน้าโปรไฟล์ของตัวเอง
export async function unlinkLine(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { lineUserId: null } })
}

/// หาผู้ใช้ในระบบจาก `lineUserId` — ใช้ตอนรับข้อความจาก LINE (F1.9)
export async function findUserByLineId(lineUserId: string) {
    return prisma.user.findFirst({
        where: { lineUserId },
        select: { id: true, name: true, email: true, role: true },
    })
}
