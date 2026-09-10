// app/api/departments/route.ts
// GET  — รายชื่อหน่วยงาน ใช้ได้ 2 แบบ
//        เรียกเปล่าๆ  → หน่วยงานที่เปิดใช้งานทั้งหมด (เติม dropdown เช่นทะเบียนครุภัณฑ์ F7.2)
//        ใส่ q/all/page → ค้นหาและแบ่งหน้า (ช่องค้นหาในฟอร์มแจ้งปัญหา + หน้าจัดการหน่วยงาน)
// POST — เพิ่มหน่วยงานใหม่ (หัวหน้าขึ้นไป)
//
// แยกจาก `api/directory` เพราะที่นั่นเป็นรายชื่อ "คนและทีม" ส่วนหน่วยงานเป็นข้อมูลโครงสร้างองค์กร

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, STAFF_ROLES, MANAGER_ROLES } from "@/lib/rbac"
import { searchParamsToObject, firstIssueMessage } from "@/lib/ticket-schema"
import { createDepartmentSchema, listDepartmentQuerySchema } from "@/lib/department-schema"
import {
    departmentSelect,
    toDepartmentDto,
    buildDepartmentWhere,
    resolveDepartmentLevel,
} from "@/lib/department-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response

    const parsed = listDepartmentQuerySchema.safeParse(
        searchParamsToObject(new URL(request.url))
    )
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const where = buildDepartmentWhere({ q: query.q, includeInactive: query.all === "1" })
    // เรียงตามรหัสเพราะรหัสงานสารบรรณเรียงตามลำดับชั้นอยู่แล้ว (010000 › 010100 › 010103)
    const orderBy = { code: "asc" } as const

    try {
        // ไม่ส่ง page มา = พฤติกรรมเดิม คืนทั้งหมดในครั้งเดียวให้ dropdown ใช้
        if (!query.page && !query.pageSize) {
            const rows = await prisma.department.findMany({
                where,
                orderBy,
                select: departmentSelect,
                // ช่องค้นหาแสดงไม่กี่รายการอยู่แล้ว จำกัดไว้กันดึงมาทั้งตารางโดยไม่จำเป็น
                ...(query.q ? { take: 20 } : {}),
            })
            const departments = rows.map(toDepartmentDto)
            return NextResponse.json({
                departments,
                total: departments.length,
                page: 1,
                pageSize: departments.length,
                totalPages: 1,
            })
        }

        const page = query.page ?? 1
        const pageSize = query.pageSize ?? 20
        const [total, rows] = await Promise.all([
            prisma.department.count({ where }),
            prisma.department.findMany({
                where,
                orderBy,
                select: departmentSelect,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ])

        return NextResponse.json({
            departments: rows.map(toDepartmentDto),
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        })
    } catch (error) {
        console.error("Departments GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อหน่วยงานได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...MANAGER_ROLES])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createDepartmentSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const resolved = await resolveDepartmentLevel(input.parentId ?? null)
        if (!resolved.ok) return badRequest(resolved.error)

        const department = await prisma.department.create({
            data: {
                name: input.name,
                code: input.code,
                parentId: input.parentId ?? null,
                level: resolved.level,
                active: input.active,
            },
            select: departmentSelect,
        })

        return NextResponse.json({ department: toDepartmentDto(department) }, { status: 201 })
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return badRequest("รหัสหน่วยงานนี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนเป็นค่าอื่น")
        }
        console.error("Departments POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกหน่วยงานได้" }, { status: 500 })
    }
}
