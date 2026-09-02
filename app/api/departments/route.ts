// app/api/departments/route.ts
// GET — รายชื่อหน่วยงานสำหรับเติม dropdown (ทะเบียนครุภัณฑ์ F7.2, และหน้าอื่นที่ต้องเลือกหน่วยงาน)
//
// แยกจาก `api/directory` เพราะที่นั่นเป็นรายชื่อ "คนและทีม" ส่วนหน่วยงานเป็นข้อมูลโครงสร้าง
// องค์กรที่หน้าอื่นๆ จะเรียกใช้ต่อไป · การจัดการหน่วยงาน (เพิ่ม/แก้/ปิด) ยังไม่อยู่ในขอบเขตเฟสนี้

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/rbac"

export async function GET() {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response

    try {
        const departments = await prisma.department.findMany({
            where: { active: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, code: true },
        })

        return NextResponse.json({ departments })
    } catch (error) {
        console.error("Departments GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อหน่วยงานได้" }, { status: 500 })
    }
}
