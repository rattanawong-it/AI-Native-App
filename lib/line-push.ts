// lib/line-push.ts
// ส่ง Push Message ไปยังกลุ่ม LINE ผ่าน LINE Messaging API
// รองรับหลายกลุ่มพร้อมกัน — ดึง Group IDs จาก Database (auto-register)
// fallback ไปใช้ ENV ถ้า DB ยังไม่มีข้อมูล

import { prisma } from "@/lib/prisma"

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!

/**
 * ดึง Group IDs ทั้งหมดที่ active จาก Database (ตาราง line_group)
 * ถ้าใน DB ยังไม่มี → fallback ไปอ่านจาก ENV (LINE_GROUP_IDS / LINE_GROUP_ID)
 */
async function getGroupIds(): Promise<string[]> {
  try {
    // 1. ดึงจาก Database ก่อน (กลุ่มที่ active)
    const groups = await prisma.lineGroup.findMany({
      where: { active: true },
      select: { groupId: true },
    })

    if (groups.length > 0) {
      return groups.map((g) => g.groupId)
    }
  } catch (error) {
    console.warn("⚠️ ไม่สามารถดึง Group IDs จาก DB:", error)
  }

  // 2. Fallback: อ่านจาก ENV
  const ids = process.env.LINE_GROUP_IDS || process.env.LINE_GROUP_ID || ""
  return ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

/**
 * ส่ง Push Message ไปยัง target เดียว (userId / groupId)
 */
async function pushMessage(to: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error(`❌ LINE Push Message Error (${to}):`, res.status, error)
    throw new Error(`LINE Push Message failed: ${res.status} → ${to}`)
  }

  console.log("✅ LINE Push Message ส่งสำเร็จ →", to)
}

/**
 * ส่ง Push Message (text) ไปยังทุกกลุ่ม LINE ที่ active ใน DB
 * - ส่งพร้อมกันทุกกลุ่มด้วย Promise.allSettled
 * - Push Message นับโควตาตามแผน LINE OA
 */
export async function pushMessageToGroup(text: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("⚠️ LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า — ข้ามการส่งแจ้งเตือน")
    return
  }

  const groupIds = await getGroupIds()
  if (groupIds.length === 0) {
    console.warn("⚠️ ไม่พบกลุ่ม LINE ที่ active — ข้ามการส่งแจ้งเตือน")
    return
  }

  const results = await Promise.allSettled(
    groupIds.map((groupId) => pushMessage(groupId, text))
  )

  const success = results.filter((r) => r.status === "fulfilled").length
  const failed = results.filter((r) => r.status === "rejected").length

  if (failed > 0) {
    console.warn(`⚠️ LINE Push: สำเร็จ ${success}/${groupIds.length} กลุ่ม (ล้มเหลว ${failed})`)
  } else {
    console.log(`✅ LINE Push: ส่งสำเร็จทั้ง ${success} กลุ่ม`)
  }
}

export async function pushMessageTo(to: string, text: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("⚠️ LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า")
    return
  }
  await pushMessage(to, text)
}