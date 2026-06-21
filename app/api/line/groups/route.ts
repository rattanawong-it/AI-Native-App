import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ดึงรายการกลุ่ม LINE ทั้งหมด
export async function GET() {
  const groups = await prisma.lineGroup.findMany({
    orderBy: { joinedAt: "desc" },
  })
  return NextResponse.json(groups)
}

// เพิ่มกลุ่มด้วยมือ (กรณี migrate จาก ENV เดิม)
export async function POST(request: NextRequest) {
  const { groupId, groupName } = await request.json()
  const group = await prisma.lineGroup.upsert({
    where: { groupId },
    update: { active: true, groupName: groupName || undefined },
    create: { groupId, groupName: groupName || null, active: true },
  })
  return NextResponse.json(group)
}