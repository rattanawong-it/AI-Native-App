// app/api/holidays/[id]/route.ts
// PATCH  — แก้ไขวันหยุด (F4.3)
// DELETE — ลบวันหยุด — ลบได้จริง ไม่มีตารางอื่นอ้างถึง
// admin เท่านั้น ตาม spec §7

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, notFound, ADMIN_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { updateHolidaySchema } from "@/lib/sla-schema"
import { invalidateBusinessCalendar } from "@/lib/business-hours"
import { utcDate } from "@/lib/sla-service"

const holidaySelect = { id: true, date: true, name: true, isRecurring: true } as const

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateHolidaySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data

    try {
        const current = await prisma.holiday.findUnique({ where: { id }, select: { id: true } })
        if (!current) return notFound("ไม่พบวันหยุดที่ต้องการ")

        const holiday = await prisma.holiday.update({
            where: { id },
            data: {
                ...(input.date !== undefined ? { date: utcDate(input.date) } : {}),
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.isRecurring !== undefined ? { isRecurring: input.isRecurring } : {}),
            },
            select: holidaySelect,
        })

        invalidateBusinessCalendar()
        return NextResponse.json({ holiday })
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return badRequest("วันที่นี้ถูกบันทึกเป็นวันหยุดไว้แล้ว")
        }
        console.error("Holiday PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถแก้ไขวันหยุดได้" }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response
    const { id } = await params

    try {
        const current = await prisma.holiday.findUnique({ where: { id }, select: { id: true } })
        if (!current) return notFound("ไม่พบวันหยุดที่ต้องการ")

        await prisma.holiday.delete({ where: { id } })
        invalidateBusinessCalendar()
        return NextResponse.json({ deleted: true })
    } catch (error) {
        console.error("Holiday DELETE Error:", error)
        return NextResponse.json({ error: "ไม่สามารถลบวันหยุดได้" }, { status: 500 })
    }
}
