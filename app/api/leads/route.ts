import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pushMessageToGroup } from "@/lib/line-push"

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, company, interest } = await request.json()

    // Validate
    if (!name || !email) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อและอีเมล" },
        { status: 400 }
      )
    }

    // 1. บันทึก Lead ลง PostgreSQL ผ่าน Prisma
    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone: phone || null,
        company: company || null,
        interest: interest || null,
        source: "website",
      },
    })

    // 2. ส่งแจ้งเตือนเข้ากลุ่ม LINE ผ่าน LINE Messaging API
    await pushMessageToGroup(
      `🔔 Lead ใหม่จากเว็บไซต์!\n` +
      `👤 ชื่อ: ${name}\n` +
      `📧 อีเมล: ${email}\n` +
      `📱 โทร: ${phone || "-"}\n` +
      `🏢 บริษัท: ${company || "-"}\n` +
      `💡 สนใจ: ${interest || "-"}\n` +
      `🕐 เวลา: ${new Date().toLocaleString("th-TH")}`
    )

    // 3. ส่ง Lead ไปยัง n8n Webhook (ถ้าตั้งค่าไว้)
    // const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
    // if (n8nWebhookUrl) {
    //   await fetch(n8nWebhookUrl, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       ...lead,
    //       timestamp: lead.createdAt.toISOString(),
    //     }),
    //   })
    // }

    return NextResponse.json({
      message: "ขอบคุณสำหรับความสนใจ! ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง",
      success: true,
    })
  } catch (error: any) {
    console.error("Lead API Error:", error)
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    )
  }
}

// ดึงรายการ Lead ทั้งหมด (สำหรับ Admin)
export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(leads)
  } catch (error: any) {
    console.error("Lead GET Error:", error)
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    )
  }
}