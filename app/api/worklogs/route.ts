// app/api/worklogs/route.ts
// GET  — รายการบันทึกเวลาทำงาน (F3.5) · เจ้าหน้าที่เห็นของตัวเอง หัวหน้าดูของคนอื่นได้ (F3.8)
// POST — บันทึกเวลาทำงานแบบ Manual (F3.5) — บันทึกในนามตัวเองเท่านั้น
//
// การผูกงาน (`refType` + id) ถูกตรวจสองชั้น: zod ตรวจว่ามี id มาคู่กับประเภท
// แล้ว route ตรวจต่อว่างานนั้นมีจริงและผู้บันทึกมีสิทธิ์เห็นงานนั้น — กัน id มั่วจากภายนอก

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, forbidden, isManager, STAFF_ROLES } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { createWorkLogSchema, listWorkLogsQuerySchema } from "@/lib/worklog-schema"
import {
    decimalToNumber,
    toWorkLogDto,
    validateWorkLogRef,
    workLogSelect,
} from "@/lib/worklog-service"
import { utcDate } from "@/lib/sla-service"

export async function GET(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listWorkLogsQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    // ดูของคนอื่นได้เฉพาะหัวหน้าขึ้นไป (F3.8) — ที่เหลือถูกบังคับกลับมาเป็นของตัวเอง
    if (query.userId && query.userId !== user.id && !isManager(user)) {
        return forbidden("ดูบันทึกเวลาของผู้อื่นได้เฉพาะหัวหน้าขึ้นไป")
    }
    const userId = query.userId ?? user.id

    const where: Prisma.WorkLogWhereInput = {
        userId,
        ...(query.refType ? { refType: query.refType } : {}),
        ...(query.from || query.to
            ? {
                  workDate: {
                      ...(query.from ? { gte: utcDate(query.from) } : {}),
                      ...(query.to ? { lte: utcDate(query.to) } : {}),
                  },
              }
            : {}),
    }

    try {
        const [rows, total, sum] = await Promise.all([
            prisma.workLog.findMany({
                where,
                select: workLogSelect,
                orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            prisma.workLog.count({ where }),
            prisma.workLog.aggregate({ where, _sum: { hours: true } }),
        ])

        return NextResponse.json({
            workLogs: rows.map(toWorkLogDto),
            total,
            // ชั่วโมงรวมของ "ทุกแถวที่ตรงเงื่อนไข" ไม่ใช่เฉพาะหน้าที่แสดง
            totalHours: decimalToNumber(sum._sum.hours),
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        })
    } catch (error) {
        console.error("WorkLog GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดบันทึกเวลาทำงานได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createWorkLogSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const refError = await validateWorkLogRef(user, input)
        if (refError) return badRequest(refError)

        const row = await prisma.workLog.create({
            data: {
                userId: user.id,
                workDate: utcDate(input.workDate),
                hours: input.hours,
                description: input.description,
                refType: input.refType,
                // เก็บเฉพาะ id ที่ตรงกับ refType — กันข้อมูลค้างเมื่อผู้ใช้สลับประเภทในฟอร์ม
                ticketId: input.refType === "ticket" ? (input.ticketId ?? null) : null,
                taskId: input.refType === "task" ? (input.taskId ?? null) : null,
                todoId: input.refType === "todo" ? (input.todoId ?? null) : null,
            },
            select: workLogSelect,
        })

        return NextResponse.json({ workLog: toWorkLogDto(row) }, { status: 201 })
    } catch (error) {
        console.error("WorkLog POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกเวลาทำงานได้" }, { status: 500 })
    }
}
