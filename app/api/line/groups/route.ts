// app/api/line/groups/route.ts
// ทะเบียนกลุ่ม LINE ที่บอทเข้าร่วม — ใช้จากหน้า /admin/line-groups จึงเป็น admin เท่านั้น
// (ไม่เกี่ยวกับ POST /api/line/webhook ที่ LINE ยิงเข้ามาและตรวจลายเซ็น HMAC ของตัวเอง)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, ADMIN_ROLES } from "@/lib/rbac"

// ดึงรายการกลุ่ม LINE ทั้งหมด
export async function GET() {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const groups = await prisma.lineGroup.findMany({
    orderBy: { joinedAt: "desc" },
  })
  return NextResponse.json(groups)
}

// เพิ่มกลุ่มด้วยมือ (กรณี migrate จาก ENV เดิม)
export async function POST(request: NextRequest) {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const { groupId, groupName } = await request.json()
  const group = await prisma.lineGroup.upsert({
    where: { groupId },
    update: { active: true, groupName: groupName || undefined },
    create: { groupId, groupName: groupName || null, active: true },
  })
  return NextResponse.json(group)
}