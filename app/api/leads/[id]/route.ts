import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// อัปเดตสถานะ Lead (PATCH /api/leads/:id)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status } = await request.json()

    // Validate status
    const validStatuses = ["new", "contacted", "qualified", "converted"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `สถานะไม่ถูกต้อง — ต้องเป็น: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(lead)
  } catch (error: any) {
    console.error("Lead PATCH Error:", error)
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "ไม่พบ Lead นี้" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    )
  }
}

// ดึงข้อมูล Lead รายตัว (GET /api/leads/:id)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lead = await prisma.lead.findUnique({ where: { id } })

    if (!lead) {
      return NextResponse.json(
        { error: "ไม่พบ Lead นี้" },
        { status: 404 }
      )
    }

    return NextResponse.json(lead)
  } catch (error: any) {
    console.error("Lead GET Error:", error)
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    )
  }
}