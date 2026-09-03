// app/api/settings/route.ts
// GET   — อ่านค่าตั้งค่าระบบที่หน้าจอแก้ได้ (เจ้าหน้าที่ขึ้นไปอ่านได้ เพราะหน้าจอทำงานต้องรู้ว่ากฎเปิดอยู่ไหม)
// PATCH — บันทึกค่าตั้งค่า (admin เท่านั้น ตาม spec §7 "ตั้งค่าระบบ")
//
// จำกัดเฉพาะคีย์ใน `EDITABLE_BOOLEAN_SETTINGS` — คีย์อื่นใน `AppSetting` (เช่น รายการชนิดไฟล์แนบ
// หรือช่องทางแจ้งเตือน) ยังไม่มีหน้าจอรองรับ จึงไม่เปิดให้เขียนทับผ่านเส้นนี้
// อ้างอิง docs/spec.md §8 ③ F3.6

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, STAFF_ROLES, ADMIN_ROLES } from "@/lib/rbac"
import { firstIssueMessage } from "@/lib/ticket-schema"
import {
    EDITABLE_BOOLEAN_SETTINGS,
    updateSettingsSchema,
    type EditableBooleanSetting,
} from "@/lib/worklog-schema"

/// ค่าเริ่มต้นเมื่อยังไม่มีแถวนั้นใน DB — ตรงกับ prisma/seed.ts
const DEFAULTS: Record<EditableBooleanSetting, { value: boolean; description: string }> = {
    "ticket.require_worklog_on_resolve": {
        value: true,
        description: "บังคับบันทึก Time Log ก่อนเปลี่ยนสถานะเป็น resolved",
    },
    "ticket.auto_assign": {
        value: true,
        description: "มอบหมายเจ้าหน้าที่อัตโนมัติตามหมวดหมู่บริการ",
    },
}

export async function GET() {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response

    try {
        const rows = await prisma.appSetting.findMany({
            where: { key: { in: [...EDITABLE_BOOLEAN_SETTINGS] } },
            select: { key: true, value: true, description: true },
        })
        const found = new Map(rows.map((r) => [r.key, r]))

        const settings = EDITABLE_BOOLEAN_SETTINGS.map((key) => {
            const row = found.get(key)
            return {
                key,
                // ค่าใน DB เป็น Json — ถ้าไม่ใช่ boolean (ถูกแก้มาผิดชนิด) ให้ถอยไปใช้ค่าเริ่มต้น
                value: typeof row?.value === "boolean" ? row.value : DEFAULTS[key].value,
                description: row?.description ?? DEFAULTS[key].description,
            }
        })

        return NextResponse.json({ settings })
    } catch (error) {
        console.error("AppSetting GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดค่าตั้งค่าระบบได้" }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    const guard = await requireRole([...ADMIN_ROLES])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = updateSettingsSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))

    try {
        await prisma.$transaction(
            parsed.data.settings.map((s) =>
                prisma.appSetting.upsert({
                    where: { key: s.key },
                    update: { value: s.value },
                    create: {
                        key: s.key,
                        value: s.value,
                        description: DEFAULTS[s.key].description,
                    },
                })
            )
        )

        return NextResponse.json({ saved: parsed.data.settings.length })
    } catch (error) {
        console.error("AppSetting PATCH Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกค่าตั้งค่าระบบได้" }, { status: 500 })
    }
}
