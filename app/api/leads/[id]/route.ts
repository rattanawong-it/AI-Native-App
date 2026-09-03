// app/api/leads/[id]/route.ts
// ข้อมูลผู้สนใจรายตัว — กลุ่ม 7 (ลูกค้าสัมพันธ์) ใน docs/spec.md §7.2 คือ manager ขึ้นไป
// ต่างจาก POST /api/leads ที่เปิดสาธารณะเพราะเป็นฟอร์มบนหน้า landing

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, MANAGER_ROLES } from "@/lib/rbac"

// อัปเดตสถานะ Lead (PATCH /api/leads/:id)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole([...MANAGER_ROLES])
  if (!guard.ok) return guard.response

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
  } catch (error) {
    console.error("Lead PATCH Error:", error)
    if ((error as { code?: string }).code === "P2025") {
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
  const guard = await requireRole([...MANAGER_ROLES])
  if (!guard.ok) return guard.response

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
  } catch (error) {
    console.error("Lead GET Error:", error)
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    )
  }
}