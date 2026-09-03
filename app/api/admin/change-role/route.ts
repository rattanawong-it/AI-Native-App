// app/api/admin/change-role/route.ts
// เปลี่ยน role ของผู้ใช้ — admin เท่านั้น
//
// สองจุดที่แก้ในเฟส 9
// 1) เดิมใช้ `session.user.role !== "admin"` ซึ่งพังกับ multi-role — ผู้ใช้ที่มี role
//    เป็น "manager,admin" จะถูกปฏิเสธ ทั้งที่เป็น admin จริง ตอนนี้ใช้ requireRole()
//    เหมือนทุก route ในระบบ (parseRoles จัดการค่าคั่นด้วยจุลภาคให้แล้ว)
// 2) เดิม validRoles ค้างอยู่ที่ ["user","manager","admin"] จากก่อน ITSM ทำให้ตั้ง
//    role `student` และ `agent` ไม่ได้ ตอนนี้อ้าง ROLES ทั้ง 5 ค่าจาก lib/roles.ts

import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { requireRole, ADMIN_ROLES, ROLES, parseRoles, type Role } from "@/lib/rbac"
import { badRequest, notFound } from "@/lib/rbac"

export async function POST(request: NextRequest) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response

    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
        return badRequest("กรุณาระบุ userId และ newRole")
    }

    // รองรับหลาย role คั่นด้วยจุลภาคเหมือนที่เก็บในคอลัมน์ user.role
    // parseRoles ตัดค่าที่ไม่รู้จักทิ้ง จึงเทียบจำนวนเพื่อจับค่าที่สะกดผิด
    const requested = String(newRole)
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
    const valid = parseRoles(newRole)

    if (requested.length !== valid.length || !requested.every((r) => (ROLES as readonly string[]).includes(r))) {
        return badRequest(`role ไม่ถูกต้อง — ต้องเป็นค่าใดค่าหนึ่งใน: ${ROLES.join(", ")}`)
    }

    // เก็บเรียงตามลำดับใน ROLES และตัดค่าซ้ำ เพื่อให้รูปแบบในฐานข้อมูลคงที่
    const normalized: Role[] = ROLES.filter((r) => valid.includes(r))

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role: normalized.join(",") },
        })

        return NextResponse.json({
            message: `เปลี่ยน role เป็น ${normalized.join(", ")} แล้ว`,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
            },
        })
    } catch {
        return notFound("ไม่พบผู้ใช้นี้ หรือแก้ไขไม่สำเร็จ")
    }
}
