// app/api/holidays/route.ts
// GET  — รายการวันหยุด (กรองตามปีได้ด้วย ?year=2026 — วันหยุดที่เกิดซ้ำทุกปีจะติดมาเสมอ)
// POST — เพิ่มวันหยุดทีละวัน (F4.3 — admin เท่านั้น ตาม spec §7)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole, badRequest, ADMIN_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { createHolidaySchema } from "@/lib/sla-schema"
import { invalidateBusinessCalendar } from "@/lib/business-hours"
import { utcDate } from "@/lib/sla-service"

const holidaySelect = { id: true, date: true, name: true, isRecurring: true } as const

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response

    const raw = new URL(request.url).searchParams.get("year")
    const year = raw ? Number(raw) : null
    if (raw && (!Number.isInteger(year) || year! < 2000 || year! > 2999)) {
        return badRequest("ปีที่ระบุไม่ถูกต้อง")
    }

    try {
        const holidays = await prisma.holiday.findMany({
            where: year
                ? {
                      OR: [
                          // วันหยุดของปีนั้นโดยตรง
                          {
                              date: {
                                  gte: utcDate(`${year}-01-01`),
                                  lt: utcDate(`${year + 1}-01-01`),
                              },
                          },
                          // วันหยุดที่เกิดซ้ำทุกปี — เก็บไว้ปีอ้างอิงเดียว แต่ใช้กับทุกปี
                          { isRecurring: true },
                      ],
                  }
                : {},
            orderBy: { date: "asc" },
            select: holidaySelect,
        })
        return NextResponse.json({ holidays })
    } catch (error) {
        console.error("Holiday GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดวันหยุดได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createHolidaySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const holiday = await prisma.holiday.create({
            data: {
                date: utcDate(input.date),
                name: input.name,
                isRecurring: input.isRecurring,
            },
            select: holidaySelect,
        })

        invalidateBusinessCalendar()
        return NextResponse.json({ holiday }, { status: 201 })
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return badRequest("วันที่นี้ถูกบันทึกเป็นวันหยุดไว้แล้ว")
        }
        console.error("Holiday POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกวันหยุดได้" }, { status: 500 })
    }
}
