// lib/line-ticket.ts
// รับแจ้งปัญหาผ่าน LINE แล้วสร้าง Ticket (F1.9)
//
// แยกออกจาก `app/api/line/webhook/route.ts` เพราะ webhook เดิมยาวและมีหน้าที่หลายอย่างอยู่แล้ว
// (RAG, ลงทะเบียนกลุ่ม) — ไฟล์นี้เก็บเฉพาะตรรกะ "ข้อความแบบไหนคือการแจ้งปัญหา และสร้าง Ticket อย่างไร"
//
// ข้อจำกัดที่ตั้งใจ: รับแจ้งเฉพาะ **แชท 1:1** ที่ผูกบัญชีแล้วเท่านั้น
//   - ในกลุ่มไม่รับแจ้ง เพราะระบุตัวผู้แจ้งไม่ได้ และกลุ่มเป็นช่องทางรับ "ประกาศ" ของทีม
//   - ยังไม่ผูกบัญชี = ไม่รู้ว่าใครแจ้ง จะสร้าง Ticket ให้ใครไม่ได้ (บอทจะบอกวิธีผูกให้)

import { prisma } from "@/lib/prisma"
import { calculatePriority } from "@/lib/priority"
import { createWithRunningNumber, nextTicketNo } from "@/lib/running-number"
import {
    computeDueDates,
    logActivity,
    resolveAutoAssign,
    ticketListSelect,
} from "@/lib/ticket-service"
import { notifyTicketCreated } from "@/lib/ticket-notify"
import { findUserByLineId } from "@/lib/line-link"

/// คำนำหน้าที่ถือว่าเป็นการแจ้งปัญหา
export const TICKET_KEYWORDS = ["แจ้งปัญหา", "แจ้ง", "/ticket", "/แจ้ง"] as const

/// คำนำหน้าที่ถือว่าเป็นการผูกบัญชี
export const LINK_KEYWORDS = ["ผูกบัญชี", "/link", "/ผูก"] as const

/// ความยาวขั้นต่ำของเนื้อหาที่ยอมสร้างเป็น Ticket — สั้นกว่านี้เจ้าหน้าที่ทำงานต่อไม่ได้
const MIN_BODY_LENGTH = 10

/// ตัดคำนำหน้าออกจากข้อความ — คืน null ถ้าข้อความไม่ได้ขึ้นต้นด้วยคำใดเลย
export function stripPrefix(text: string, keywords: readonly string[]): string | null {
    const trimmed = text.trim()
    for (const keyword of keywords) {
        if (trimmed.toLowerCase().startsWith(keyword.toLowerCase())) {
            return trimmed.slice(keyword.length).trim()
        }
    }
    return null
}

/// หัวข้อ Ticket จากข้อความ — ใช้บรรทัดแรก ตัดที่ 200 ตัวอักษรตามที่ schema กำหนด
export function titleFrom(body: string): string {
    const firstLine = body.split("\n")[0].trim()
    const title = firstLine.length > 0 ? firstLine : body.trim()
    return title.length > 200 ? `${title.slice(0, 197)}...` : title
}

export type CreateFromLineResult =
    | { ok: true; ticketNo: string; ticketId: string; assigneeName: string | null }
    | { ok: false; reason: "not_linked" | "too_short" | "no_category" | "error"; message: string }

/// หมวดหมู่ปลายทางของ Ticket ที่แจ้งผ่าน LINE
///
/// ยังไม่มีการถามหมวดหมู่ในแชท จึงส่งเข้าหมวดที่ตั้งค่าไว้ใน `AppSetting` คีย์
/// `ticket.line_default_category` (เก็บเป็น slug) · ถ้าไม่ได้ตั้ง จะใช้หมวดที่เปิดใช้งาน
/// และเรียงลำดับต้นสุด เพื่อให้ใบงานยังเข้าคิวได้แทนที่จะตกหล่น
async function resolveCategoryId(): Promise<string | null> {
    const setting = await prisma.appSetting.findUnique({
        where: { key: "ticket.line_default_category" },
        select: { value: true },
    })
    const slug = typeof setting?.value === "string" ? setting.value : null

    if (slug) {
        const bySlug = await prisma.serviceCategory.findFirst({
            where: { slug, active: true },
            select: { id: true },
        })
        if (bySlug) return bySlug.id
    }

    const fallback = await prisma.serviceCategory.findFirst({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true },
    })
    return fallback?.id ?? null
}

/// สร้าง Ticket จากข้อความใน LINE — คืนผลเป็นค่าเสมอเพื่อให้ webhook ตอบกลับผู้ใช้ได้ตรงเหตุ
export async function createTicketFromLine(
    lineUserId: string,
    rawBody: string
): Promise<CreateFromLineResult> {
    const body = rawBody.trim()

    if (body.length < MIN_BODY_LENGTH) {
        return {
            ok: false,
            reason: "too_short",
            message: `กรุณาอธิบายปัญหาอย่างน้อย ${MIN_BODY_LENGTH} ตัวอักษร\n\nตัวอย่าง:\nแจ้งปัญหา เข้า WiFi ห้อง 401 ไม่ได้ตั้งแต่เช้า`,
        }
    }

    const user = await findUserByLineId(lineUserId)
    if (!user) {
        return {
            ok: false,
            reason: "not_linked",
            message:
                "ยังไม่ได้ผูกบัญชี LINE กับระบบ\n\n" +
                "1) เข้าเว็บระบบ → หน้าโปรไฟล์ของฉัน\n" +
                "2) กด “ผูกบัญชี LINE” เพื่อรับรหัส 6 หลัก\n" +
                "3) พิมพ์ในแชทนี้ว่า: ผูกบัญชี <รหัส>",
        }
    }

    try {
        const categoryId = await resolveCategoryId()
        if (!categoryId) {
            return {
                ok: false,
                reason: "no_category",
                message: "ระบบยังไม่ได้ตั้งค่าหมวดหมู่บริการ กรุณาติดต่อผู้ดูแลระบบ",
            }
        }

        // แจ้งผ่านแชทไม่ได้ถาม Impact/Urgency จึงตั้งเป็น "กลาง" ทั้งคู่ → priority = ปานกลาง
        // เจ้าหน้าที่ปรับระดับได้ภายหลังในหน้ารายละเอียด (F2.4)
        const impact = "medium"
        const urgency = "medium"
        const priority = calculatePriority(impact, urgency)

        const now = new Date()
        const { responseDueAt, resolutionDueAt } = await computeDueDates(priority, categoryId, now)
        const auto = await resolveAutoAssign(categoryId)

        const requester = await prisma.user.findUnique({
            where: { id: user.id },
            select: { departmentId: true },
        })

        const ticket = await createWithRunningNumber(
            () => nextTicketNo(now),
            (ticketNo) =>
                prisma.ticket.create({
                    data: {
                        ticketNo,
                        title: titleFrom(body),
                        description: body,
                        categoryId,
                        requesterId: user.id,
                        departmentId: requester?.departmentId ?? null,
                        channel: "line",
                        impact,
                        urgency,
                        priority,
                        status: auto.assigneeId ? "assigned" : "new",
                        assigneeId: auto.assigneeId,
                        teamId: auto.teamId,
                        responseDueAt,
                        resolutionDueAt,
                    },
                    select: ticketListSelect,
                })
        )

        await logActivity(prisma, {
            ticketId: ticket.id,
            actorId: user.id,
            action: "created",
            toValue: ticket.ticketNo,
            note: "แจ้งผ่าน LINE",
        })

        if (auto.assigneeId) {
            await logActivity(prisma, {
                ticketId: ticket.id,
                actorId: user.id,
                action: "assigned",
                toValue: auto.assigneeId,
                // เหตุผลที่เลือกคนนี้มาจาก resolveAutoAssign เพื่อให้ตรวจย้อนหลังได้ (F2.11)
                note: auto.reason ?? "มอบหมายอัตโนมัติตามหมวดหมู่บริการ",
            })
        }

        void notifyTicketCreated(ticket, user.id)

        return {
            ok: true,
            ticketNo: ticket.ticketNo,
            ticketId: ticket.id,
            assigneeName: ticket.assignee?.name ?? null,
        }
    } catch (error) {
        console.error("createTicketFromLine Error:", error)
        return {
            ok: false,
            reason: "error",
            message: "ขออภัยครับ ระบบบันทึกใบแจ้งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        }
    }
}

/// ข้อความตอบกลับเมื่อสร้าง Ticket สำเร็จ
export function successReply(
    result: Extract<CreateFromLineResult, { ok: true }>,
    baseUrl: string
): string {
    return [
        `✅ รับเรื่องแล้ว: ${result.ticketNo}`,
        "",
        result.assigneeName
            ? `ผู้รับผิดชอบ: ${result.assigneeName}`
            : "อยู่ระหว่างรอเจ้าหน้าที่รับเรื่อง",
        "",
        `ติดตามสถานะได้ที่:`,
        `${baseUrl}/service/tickets/${result.ticketId}`,
    ].join("\n")
}
