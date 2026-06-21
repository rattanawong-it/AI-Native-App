import { NextRequest, NextResponse } from "next/server"

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, service, message } = body

    // Validate required fields
    if (!name || !phone || !service) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // ส่งข้อมูลไป n8n Webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        phone,
        service,
        message: message || "",
        timestamp: new Date().toISOString(),
        source: "website",
      }),
    })

    if (!n8nResponse.ok) {
      console.error("n8n webhook error:", await n8nResponse.text())
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Contact API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}