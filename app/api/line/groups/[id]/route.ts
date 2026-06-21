import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// อัปเดตสถานะกลุ่ม (เปิด/ปิดการแจ้งเตือน)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { active, groupName } = await request.json()

    const group = await prisma.lineGroup.update({
      where: { id },
      data: {
        ...(typeof active === "boolean" ? { active } : {}),
        ...(groupName !== undefined ? { groupName } : {}),
      },
    })

    return NextResponse.json(group)
  } catch (error: any) {
    console.error("LINE Group PATCH Error:", error)
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "ไม่พบกลุ่มนี้" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    )
  }
}

// ลบกลุ่ม
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.lineGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("LINE Group DELETE Error:", error)
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "ไม่พบกลุ่มนี้" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    )
  }
}