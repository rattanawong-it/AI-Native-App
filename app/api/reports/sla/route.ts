// app/api/reports/sla/route.ts
// GET — รายงาน SLA Compliance: % ตรงเวลา แยกตาม Priority / หมวดหมู่ / เจ้าหน้าที่ / ช่วงเวลา (F4.10)
//
// นับเฉพาะใบที่ "รู้ผลแล้ว" — ทำเสร็จแล้ว หรือเลยกำหนดไปแล้ว (ดู lib/sla-service.ts)
// ใบที่ยังอยู่ในกำหนดจะไม่ถูกนับเข้า % เพื่อไม่ให้ตัวเลขแกว่งตามเวลาที่เปิดดู
//
// สิทธิ์ตาม spec §7: agent เห็นเฉพาะงานของตัวเอง · manager / admin เห็นทั้งระบบ

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest, isManager, STAFF_ROLES } from "@/lib/rbac"
import { PRIORITY_LABEL, PRIORITY_WEIGHT, type Priority } from "@/lib/priority"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { slaReportQuerySchema } from "@/lib/sla-schema"
import {
    StatGrouper,
    accumulate,
    emptyStat,
    evaluateTicketSla,
    finalize,
} from "@/lib/sla-service"
import {
    endOfThaiDay,
    startOfThaiDay,
    thaiMonthKey,
    thaiMonthLabel,
    thaiToday,
} from "@/lib/thai-date"

/// เพดานจำนวนใบต่อการออกรายงานหนึ่งครั้ง — คำนวณในหน่วยความจำ จึงต้องจำกัดไว้
const MAX_ROWS = 20000

/// จำนวนวันย้อนหลังเมื่อผู้ใช้ไม่ได้เลือกช่วงเวลา
const DEFAULT_DAYS = 30

const reportSelect = {
    id: true,
    priority: true,
    createdAt: true,
    respondedAt: true,
    resolvedAt: true,
    responseDueAt: true,
    resolutionDueAt: true,
    categoryId: true,
    assigneeId: true,
    category: { select: { id: true, name: true } },
    assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect

export async function GET(request: NextRequest) {
    const guard = await requireRole([...STAFF_ROLES])
    if (!guard.ok) return guard.response
    const { user } = guard

    const url = new URL(request.url)
    const raw: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
        if (value !== "") raw[key] = value
    })

    const parsed = slaReportQuerySchema.safeParse(raw)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    const fromIso = query.from ?? thaiToday(-(DEFAULT_DAYS - 1))
    const toIso = query.to ?? thaiToday()
    if (fromIso > toIso) return badRequest("วันที่เริ่มต้นต้องไม่หลังวันที่สิ้นสุด")

    // agent ดูได้เฉพาะงานที่ตัวเองรับผิดชอบ (spec §7 — รายงาน/Dashboard รวม)
    const scopedToSelf = !isManager(user)
    const assigneeId = scopedToSelf ? user.id : query.assigneeId

    const where: Prisma.TicketWhereInput = {
        createdAt: { gte: startOfThaiDay(fromIso), lte: endOfThaiDay(toIso) },
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(assigneeId
            ? assigneeId === "unassigned"
                ? { assigneeId: null }
                : { assigneeId }
            : {}),
        ...(query.priority.length > 0 ? { priority: { in: query.priority } } : {}),
    }

    try {
        const rows = await prisma.ticket.findMany({
            where,
            select: reportSelect,
            orderBy: { createdAt: "asc" },
            take: MAX_ROWS,
        })

        const now = new Date()
        const summary = emptyStat()
        const byPriority = new StatGrouper()
        const byCategory = new StatGrouper()
        const byAssignee = new StatGrouper()
        const byMonth = new StatGrouper()

        for (const t of rows) {
            const outcome = evaluateTicketSla(t, now)
            accumulate(summary, outcome)
            byPriority.add(
                t.priority,
                PRIORITY_LABEL[t.priority as Priority] ?? t.priority,
                outcome
            )
            byCategory.add(t.categoryId, t.category?.name ?? "ไม่ระบุหมวดหมู่", outcome)
            byAssignee.add(
                t.assigneeId ?? "unassigned",
                t.assignee?.name ?? "ยังไม่มอบหมาย",
                outcome
            )
            byMonth.add(thaiMonthKey(t.createdAt), thaiMonthLabel(t.createdAt), outcome)
        }

        return NextResponse.json({
            range: { from: fromIso, to: toIso },
            scope: scopedToSelf ? "own" : "all",
            truncated: rows.length >= MAX_ROWS,
            summary: finalize(summary),
            byPriority: byPriority.result(
                (a, b) =>
                    (PRIORITY_WEIGHT[b.key as Priority] ?? 0) -
                    (PRIORITY_WEIGHT[a.key as Priority] ?? 0)
            ),
            byCategory: byCategory.result(),
            byAssignee: byAssignee.result(),
            byMonth: byMonth.result((a, b) => a.key.localeCompare(b.key)),
        })
    } catch (error) {
        console.error("SLA Report GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถออกรายงาน SLA ได้" }, { status: 500 })
    }
}
