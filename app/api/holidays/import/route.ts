// app/api/holidays/import/route.ts
// POST — นำเข้าวันหยุดประจำปีทีเดียวทั้งชุด (F4.3 — admin เท่านั้น)
//
// ใช้ตอนขึ้นปีใหม่: วันหยุดทางจันทรคติ (มาฆบูชา วิสาขบูชา เข้าพรรษา) เปลี่ยนวันทุกปี
// จึงต้องนำเข้าตามประกาศสำนักนายกรัฐมนตรีของปีนั้น
//
// `overwrite = false` (ค่าเริ่มต้น) จะข้ามวันที่ที่มีอยู่แล้ว ไม่ทับของเดิม

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, ADMIN_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { importHolidaysSchema } from "@/lib/sla-schema"
import { invalidateBusinessCalendar } from "@/lib/business-hours"
import { utcDate } from "@/lib/sla-service"

export async function POST(request: NextRequest) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = importHolidaysSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const { items, overwrite } = parsed.data

    // กันวันที่ซ้ำกันเองภายในชุดที่ส่งมา — เก็บรายการหลังสุดของวันนั้น
    const unique = new Map(items.map((h) => [h.date, h]))

    try {
        const dates = [...unique.keys()].map(utcDate)
        const existing = await prisma.holiday.findMany({
            where: { date: { in: dates } },
            select: { id: true, date: true },
        })
        const existingByDate = new Map(existing.map((h) => [h.date.toISOString().slice(0, 10), h.id]))

        let created = 0
        let updated = 0
        let skipped = 0

        for (const [iso, item] of unique) {
            const found = existingByDate.get(iso)
            if (found) {
                if (!overwrite) {
                    skipped += 1
                    continue
                }
                await prisma.holiday.update({
                    where: { id: found },
                    data: { name: item.name, isRecurring: item.isRecurring },
                })
                updated += 1
                continue
            }
            await prisma.holiday.create({
                data: { date: utcDate(iso), name: item.name, isRecurring: item.isRecurring },
            })
            created += 1
        }

        invalidateBusinessCalendar()
        return NextResponse.json({ created, updated, skipped, total: unique.size })
    } catch (error) {
        console.error("Holiday import Error:", error)
        return NextResponse.json({ error: "นำเข้าวันหยุดไม่สำเร็จ" }, { status: 500 })
    }
}
