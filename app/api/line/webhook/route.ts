// app/api/line/webhook/route.ts
// Webhook ของ LINE — รับ event ทุกชนิดจาก LINE Messaging API
//
// หน้าที่ของไฟล์นี้ (เรียงตามลำดับที่ประมวลผล):
//   1. ตรวจ signature ทุกครั้ง — ปฏิเสธคำขอที่ไม่ได้มาจาก LINE จริง
//   2. บอทเข้า/ออกกลุ่ม → ลงทะเบียน/ปิดกลุ่มใน `LineGroup` อัตโนมัติ
//   3. ข้อความในกลุ่ม → ตอบด้วย RAG เฉพาะเมื่อมี keyword นำหน้า
//   4. ข้อความในแชท 1:1 → คำสั่ง Helpdesk มาก่อน (ผูกบัญชี / แจ้งปัญหา) แล้วค่อยตกไปให้ RAG
//
// เพิ่มในเฟส 4: ข้อ 4 ส่วนคำสั่ง Helpdesk — F1.9 (แจ้ง Ticket ผ่าน LINE) และ
// F8.5 (ผูก `lineUserId` เพื่อรับแจ้งเตือนรายบุคคล) · ตรรกะอยู่ใน `lib/line-ticket.ts` และ `lib/line-link.ts`

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { generateRAGResponse } from "@/lib/rag-service"
import { prisma } from "@/lib/prisma"
import { redeemBindCode } from "@/lib/line-link"
import {
  LINK_KEYWORDS,
  TICKET_KEYWORDS,
  createTicketFromLine,
  stripPrefix,
  successReply,
} from "@/lib/line-ticket"
import { appBaseUrl } from "@/lib/notification-templates"

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN

// Keyword สำหรับเรียก Bot ใน Group
const TRIGGER_KEYWORDS = ["/bot", "!ask", "/ถาม", "@bot"]

// ตรวจสอบ Signature จาก LINE
function verifySignature(body: string, signature: string): boolean {
  if (!LINE_CHANNEL_SECRET || !signature) {
    return false
  }

  const hash = crypto
    .createHmac("SHA256", LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64")
  return hash === signature
}

// ส่งข้อความตอบกลับไปยัง LINE (แบบ text ธรรมดา สำหรับ error)
async function replyMessage(replyToken: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  })
}

// ดึงชื่อกลุ่มจาก LINE API
async function getGroupName(groupId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
    })
    if (res.ok) {
      const data = await res.json()
      return data.groupName || null
    }
    return null
  } catch {
    return null
  }
}

// บันทึก Group ID ลง Database เมื่อ Bot ถูกเชิญเข้ากลุ่ม
async function registerGroup(groupId: string) {
  const groupName = await getGroupName(groupId)
  await prisma.lineGroup.upsert({
    where: { groupId },
    update: { active: true, groupName },
    create: { groupId, groupName, active: true },
  })
  console.log(`✅ บันทึกกลุ่ม LINE: ${groupName || groupId}`)
}

// ปิดการแจ้งเตือนกลุ่มเมื่อ Bot ถูกเตะออก
async function unregisterGroup(groupId: string) {
  await prisma.lineGroup.update({
    where: { groupId },
    data: { active: false },
  }).catch(() => {}) // ถ้ายังไม่มี record ก็ข้ามไป
  console.log(`🚫 Bot ออกจากกลุ่ม: ${groupId}`)
}

// ส่ง Flex Message ตอบกลับไปยัง LINE
async function replyFlexMessage(
  replyToken: string,
  answer: string,
  sources: Array<{ source: string; similarity: number }>
) {
  const flexMessage = {
    type: "flex",
    altText: answer.substring(0, 100),
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🤖 AI Assistant",
            weight: "bold",
            size: "lg",
            color: "#1a56db",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: answer,
            wrap: true,
            size: "sm",
          },
          ...(sources.length > 0
            ? [
                {
                  type: "separator" as const,
                  margin: "md",
                },
                {
                  type: "text" as const,
                  text: "📎 แหล่งอ้างอิง",
                  size: "xs" as const,
                  color: "#999999",
                  margin: "md",
                },
                ...sources.slice(0, 2).map((s) => ({
                  type: "text" as const,
                  text: `• ${s.source} (${Math.round(s.similarity * 100)}%)`,
                  size: "xs" as const,
                  color: "#999999",
                })),
              ]
            : []),
        ],
      },
    },
  }

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [flexMessage],
    }),
  })
}

// ===== F1.9 / F8.5 — คำสั่งของระบบ Helpdesk ในแชท 1:1 =====
//
// รับเฉพาะแชทส่วนตัว เพราะต้องระบุตัวผู้แจ้งให้ได้ก่อนจึงจะสร้าง Ticket แทนเขาได้
// คืน `true` เมื่อจัดการข้อความนี้ไปแล้ว (ผู้เรียกจะได้ไม่ส่งต่อให้ RAG ตอบซ้ำ)
async function handleHelpdeskCommand(
  text: string,
  lineUserId: string | undefined,
  replyToken: string
): Promise<boolean> {
  if (!lineUserId) return false

  // ── ผูกบัญชีด้วยรหัสที่ขอจากหน้าโปรไฟล์ ──
  const linkArg = stripPrefix(text, LINK_KEYWORDS)
  if (linkArg !== null) {
    const code = linkArg.split(/\s+/)[0] ?? ""
    if (!code) {
      await replyMessage(
        replyToken,
        "กรุณาพิมพ์รหัสต่อท้ายด้วย เช่น:\nผูกบัญชี A3K9PT\n\nขอรหัสได้ที่หน้าโปรไฟล์ของฉันในเว็บระบบ"
      )
      return true
    }

    const result = await redeemBindCode(code, lineUserId)
    if (result.ok) {
      await replyMessage(
        replyToken,
        `✅ ผูกบัญชีสำเร็จ — สวัสดีครับคุณ${result.userName}\n\n` +
          "จากนี้จะได้รับแจ้งเตือนความคืบหน้าของงานทาง LINE\n" +
          "และแจ้งปัญหาได้โดยพิมพ์ว่า:\nแจ้งปัญหา <รายละเอียด>"
      )
    } else {
      const reason: Record<typeof result.reason, string> = {
        not_found: "ไม่พบรหัสนี้ กรุณาตรวจสอบอีกครั้ง",
        expired: "รหัสหมดอายุแล้ว (มีอายุ 10 นาที) กรุณาขอรหัสใหม่",
        already_linked: "บัญชี LINE นี้ผูกกับผู้ใช้อื่นอยู่แล้ว กรุณายกเลิกการผูกจากบัญชีเดิมก่อน",
        user_missing: "ไม่พบบัญชีผู้ใช้ที่ออกรหัสนี้",
      }
      await replyMessage(replyToken, `❌ ผูกบัญชีไม่สำเร็จ\n${reason[result.reason]}`)
    }
    return true
  }

  // ── แจ้งปัญหา ──
  const ticketBody = stripPrefix(text, TICKET_KEYWORDS)
  if (ticketBody !== null) {
    const result = await createTicketFromLine(lineUserId, ticketBody)
    await replyMessage(
      replyToken,
      result.ok ? successReply(result, appBaseUrl()) : result.message
    )
    return true
  }

  return false
}

export async function POST(request: NextRequest) {
  try {
    if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) {
      console.error("LINE Webhook Error: missing LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN")
      return NextResponse.json(
        { error: "LINE webhook not configured" },
        { status: 500 }
      )
    }

    const body = await request.text()
    const signature = request.headers.get("x-line-signature") || ""

    // 1. ตรวจสอบ Signature
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const data = JSON.parse(body)

    // 2. วนลูปประมวลผล Events
    for (const event of data.events) {

      // ===== จัดการ Event: Bot เข้า/ออกกลุ่ม =====
      if (event.type === "join" && event.source?.groupId) {
        // Bot ถูกเชิญเข้ากลุ่ม → บันทึก Group ID ลง DB อัตโนมัติ
        await registerGroup(event.source.groupId)
        await replyMessage(
          event.replyToken,
          "สวัสดีครับ! 🤖 ผมพร้อมตอบคำถามแล้ว\n\nพิมพ์ @bot ตามด้วยคำถาม เช่น:\n@bot ตรวจสอบข้อมูลล่าสุดให้หน่อย"
        )
        continue
      }

      if (event.type === "leave" && event.source?.groupId) {
        // Bot ถูกเตะออกจากกลุ่ม → ปิดการแจ้งเตือน
        await unregisterGroup(event.source.groupId)
        continue
      }

      // ===== จัดการ Event: ข้อความ =====
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text
        const replyToken = event.replyToken
        const isGroup = event.source.type === "group" || event.source.type === "room"

        // Auto-register: ถ้ามีข้อความจากกลุ่มที่ยังไม่ได้บันทึก → บันทึกเลย
        if (isGroup && event.source.groupId) {
          registerGroup(event.source.groupId).catch(() => {})
        }

        // ใน Group: ตอบเฉพาะเมื่อมี keyword
        if (isGroup) {
          const hasTrigger = TRIGGER_KEYWORDS.some((keyword) =>
            userMessage.toLowerCase().startsWith(keyword.toLowerCase())
          )

          if (!hasTrigger) continue // ข้ามข้อความนี้

          // ลบ keyword ออกจากข้อความ
          let cleanMessage = userMessage
          for (const keyword of TRIGGER_KEYWORDS) {
            cleanMessage = cleanMessage
              .replace(new RegExp(`^${keyword}\\s*`, "i"), "")
              .trim()
          }

          // สร้างคำตอบด้วย RAG
          try {
            const response = await generateRAGResponse(cleanMessage, [], 3)
            const sources = response.sources.map((s) => ({
              source: s.metadata?.source || "N/A",
              similarity: s.similarity ?? 0,
            }))
            await replyFlexMessage(replyToken, response.answer, sources)
          } catch {
            await replyMessage(
              replyToken,
              "ขออภัยครับ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง"
            )
          }
        } else {
          // Chat 1:1: คำสั่งของ Helpdesk มาก่อน แล้วค่อยตกไปให้ RAG ตอบ (F1.9, F8.5)
          const handled = await handleHelpdeskCommand(
            userMessage,
            event.source?.userId,
            replyToken
          )
          if (handled) continue

          try {
            const response = await generateRAGResponse(userMessage, [], 3)
            const sources = response.sources.map((s) => ({
              source: s.metadata?.source || "N/A",
              similarity: s.similarity ?? 0,
            }))
            await replyFlexMessage(replyToken, response.answer, sources)
          } catch {
            await replyMessage(
              replyToken,
              "ขออภัยครับ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง"
            )
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("LINE Webhook Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}