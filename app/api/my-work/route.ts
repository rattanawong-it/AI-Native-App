// app/api/my-work/route.ts
// GET — งานของฉันรวม 3 ประเภทในรายการเดียว (F3.1, F3.2)
//
//   Ticket    ที่ `assigneeId = me`   และยังไม่ปิด
//   Task      ที่ `assigneeId = me`   และยังไม่ done
//   TodoItem  ที่ `ownerId = me`
//
// การรวมสามตารางอยู่ที่ `loadWorkItems()` ใน lib/worklog-service.ts — ใช้ร่วมกับ
// widget งานวันนี้/เลยกำหนดบนแดชบอร์ด ตัวเลขสองที่จึงตรงกันเสมอ
// การกรองและเรียงทำในหน่วยความจำ จำกัดด้วย `limit` (สูงสุด 200 รายการ) เพราะเป็น
// "งานของคนเดียว" ปริมาณจึงอยู่ในหลักสิบเสมอ ไม่ใช่รายงานทั้งระบบ

import { NextRequest, NextResponse } from "next/server"
import { requireRole, badRequest } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { myWorkQuerySchema } from "@/lib/worklog-schema"
import { compareWorkItems, isDueToday, isOverdue, loadWorkItems } from "@/lib/worklog-service"
import { thaiToday } from "@/lib/thai-date"

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = myWorkQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    // state=done ต้องดึงงานที่จบแล้วมาด้วย ส่วน state อื่นสนใจเฉพาะงานที่ยังค้าง
    const includeDone = query.state === "done"

    try {
        const all = await loadWorkItems(user.id, { includeDone, search: query.q })
        const now = new Date()
        const today = thaiToday()

        // นับจากชุดเต็มก่อนกรอง เพื่อให้ตัวเลขบนแท็บไม่เปลี่ยนตามแท็บที่เลือกอยู่
        const counts = {
            all: all.length,
            ticket: all.filter((i) => i.kind === "ticket").length,
            task: all.filter((i) => i.kind === "task").length,
            todo: all.filter((i) => i.kind === "todo").length,
            overdue: all.filter((i) => isOverdue(i, now)).length,
            today: all.filter((i) => isDueToday(i, today)).length,
        }

        let items = query.kind === "all" ? all : all.filter((i) => i.kind === query.kind)
        if (query.state === "overdue") items = items.filter((i) => isOverdue(i, now))
        if (query.state === "today") items = items.filter((i) => isDueToday(i, today))

        items.sort(compareWorkItems)
        const truncated = items.length > query.limit

        return NextResponse.json({
            items: items.slice(0, query.limit),
            counts,
            truncated,
        })
    } catch (error) {
        console.error("MyWork GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดงานของฉันได้" }, { status: 500 })
    }
}
