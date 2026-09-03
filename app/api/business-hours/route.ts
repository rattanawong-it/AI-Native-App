// app/api/business-hours/route.ts
// GET — เวลาทำการทั้งสัปดาห์ (ผู้ใช้ที่ล็อกอินแล้วดูได้ ใช้บอกว่า SLA นับเวลาช่วงไหน)
// PUT — บันทึกเวลาทำการทั้งสัปดาห์ในครั้งเดียว (F4.2 — admin เท่านั้น ตาม spec §7)
//
// ทุกครั้งที่บันทึกต้องล้าง cache ของ lib/business-hours.ts ไม่งั้นกำหนดเวลา SLA
// ของ Ticket ที่แจ้งเข้ามาภายใน 5 นาทีถัดไปจะยังคำนวณด้วยปฏิทินเดิม

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole, badRequest, ADMIN_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateBusinessHoursSchema } from "@/lib/sla-schema"
import { invalidateBusinessCalendar } from "@/lib/business-hours"

const hourSelect = {
    id: true,
    dayOfWeek: true,
    startTime: true,
    endTime: true,
    isWorkingDay: true,
} as const

/// แถวเวลาทำการที่ API คืนให้ UI — `id` เป็น null เมื่อยังไม่มีแถวนั้นใน DB
interface HourRow {
    id: string | null
    dayOfWeek: number
    startTime: string
    endTime: string
    isWorkingDay: boolean
}

/// เติมวันที่ยังไม่มีแถวใน DB ให้ครบ 7 วัน เพื่อให้หน้า admin แสดงตารางเต็มสัปดาห์ได้เสมอ
function fillWeek(rows: HourRow[]): HourRow[] {
    const start = process.env.DEFAULT_WORK_START || "08:30"
    const end = process.env.DEFAULT_WORK_END || "16:30"
    const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]))

    return Array.from({ length: 7 }, (_, dayOfWeek) => {
        const found = byDay.get(dayOfWeek)
        if (found) return found
        return {
            id: null,
            dayOfWeek,
            startTime: start,
            endTime: end,
            // ค่าเริ่มต้นของระบบคือ จ.–ศ. ทำการ
            isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
        }
    })
}

export async function GET() {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response

    try {
        const rows = await prisma.businessHour.findMany({
            orderBy: { dayOfWeek: "asc" },
            select: hourSelect,
        })
        return NextResponse.json({ hours: fillWeek(rows) })
    } catch (error) {
        console.error("BusinessHour GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดเวลาทำการได้" }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateBusinessHoursSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    try {
        await prisma.$transaction(
            parsed.data.hours.map((h) =>
                prisma.businessHour.upsert({
                    where: { dayOfWeek: h.dayOfWeek },
                    update: {
                        startTime: h.startTime,
                        endTime: h.endTime,
                        isWorkingDay: h.isWorkingDay,
                    },
                    create: {
                        dayOfWeek: h.dayOfWeek,
                        startTime: h.startTime,
                        endTime: h.endTime,
                        isWorkingDay: h.isWorkingDay,
                    },
                })
            )
        )

        invalidateBusinessCalendar()

        const rows = await prisma.businessHour.findMany({
            orderBy: { dayOfWeek: "asc" },
            select: hourSelect,
        })
        return NextResponse.json({ hours: fillWeek(rows) })
    } catch (error) {
        console.error("BusinessHour PUT Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกเวลาทำการได้" }, { status: 500 })
    }
}
