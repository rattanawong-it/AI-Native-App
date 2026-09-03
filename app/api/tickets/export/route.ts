// app/api/tickets/export/route.ts
// GET — ส่งออกรายการ Ticket เป็นไฟล์ Excel (F1.12)
//
// ใช้ฟิลเตอร์ชุดเดียวกับหน้ารายการ จึงส่ง query string เดิมมาได้ตรงๆ
// และยังผูก row-level scope ตาม role ไว้เหมือนเดิม (NFR3)

import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, STAFF_ROLES } from "@/lib/rbac"
import { PRIORITY_LABEL, type Priority } from "@/lib/priority"
import {
    TICKET_STATUS_LABEL,
    TICKET_CHANNEL_LABEL,
    type TicketStatus,
    type TicketChannel,
} from "@/lib/ticket-workflow"
import {
    listTicketsQuerySchema,
    searchParamsToObject,
    firstIssueMessage,
} from "@/lib/ticket-schema"
import {
    buildTicketOrderBy,
    buildTicketWhere,
    sortByQueue,
    ticketListSelect,
} from "@/lib/ticket-service"

/// จำนวนแถวสูงสุดต่อการส่งออกหนึ่งครั้ง — กันไฟล์ใหญ่เกินจนหน่วง
const MAX_ROWS = 5000

const BKK = "th-TH"

function formatDateTime(value: Date | null): string {
    if (!value) return "-"
    return value.toLocaleString(BKK, { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })
}

export async function GET(request: NextRequest) {
    // ส่งออกรายงานเป็นสิทธิ์ของเจ้าหน้าที่ขึ้นไป (spec §7 — รายงาน)
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = listTicketsQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    try {
        const rows = await prisma.ticket.findMany({
            where: buildTicketWhere(query, user),
            select: ticketListSelect,
            orderBy: buildTicketOrderBy(query.sort),
            take: MAX_ROWS,
        })
        const ordered = query.sort === "queue" ? sortByQueue(rows) : rows

        const workbook = new ExcelJS.Workbook()
        workbook.creator = "ระบบบริหารงานบริการศูนย์ไอที"
        workbook.created = new Date()

        const sheet = workbook.addWorksheet("รายการ Ticket")
        sheet.columns = [
            { header: "เลขที่", key: "ticketNo", width: 18 },
            { header: "หัวข้อ", key: "title", width: 45 },
            { header: "หมวดหมู่", key: "category", width: 24 },
            { header: "ผู้แจ้ง", key: "requester", width: 22 },
            { header: "ผู้รับผิดชอบ", key: "assignee", width: 22 },
            { header: "ทีม", key: "team", width: 22 },
            { header: "ช่องทาง", key: "channel", width: 14 },
            { header: "ความสำคัญ", key: "priority", width: 12 },
            { header: "สถานะ", key: "status", width: 16 },
            { header: "วันที่แจ้ง", key: "createdAt", width: 18 },
            { header: "กำหนดตอบกลับ", key: "responseDueAt", width: 18 },
            { header: "กำหนดแก้ไข", key: "resolutionDueAt", width: 18 },
            { header: "ตอบกลับเมื่อ", key: "respondedAt", width: 18 },
            { header: "แก้ไขเสร็จเมื่อ", key: "resolvedAt", width: 18 },
            { header: "เกิน SLA ตอบกลับ", key: "responseBreached", width: 16 },
            { header: "เกิน SLA แก้ไข", key: "resolutionBreached", width: 16 },
        ]

        sheet.getRow(1).font = { bold: true }
        sheet.getRow(1).alignment = { vertical: "middle" }
        sheet.views = [{ state: "frozen", ySplit: 1 }]

        for (const t of ordered) {
            sheet.addRow({
                ticketNo: t.ticketNo,
                title: t.title,
                category: t.category.name,
                requester: t.requester.name,
                assignee: t.assignee?.name ?? "-",
                team: t.team?.name ?? "-",
                channel: TICKET_CHANNEL_LABEL[t.channel as TicketChannel] ?? t.channel,
                priority: PRIORITY_LABEL[t.priority as Priority] ?? t.priority,
                status: TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status,
                createdAt: formatDateTime(t.createdAt),
                responseDueAt: formatDateTime(t.responseDueAt),
                resolutionDueAt: formatDateTime(t.resolutionDueAt),
                respondedAt: formatDateTime(t.respondedAt),
                resolvedAt: formatDateTime(t.resolvedAt),
                responseBreached: t.responseBreached ? "เกิน" : "-",
                resolutionBreached: t.resolutionBreached ? "เกิน" : "-",
            })
        }

        const buffer = await workbook.xlsx.writeBuffer()
        const stamp = new Date().toISOString().slice(0, 10)

        return new NextResponse(buffer as ArrayBuffer, {
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="tickets-${stamp}.xlsx"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        console.error("Ticket export GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถส่งออกรายงานได้" }, { status: 500 })
    }
}
