// app/api/my-work/route.ts
// GET — งานของฉันรวม 3 ประเภทในรายการเดียว (F3.1, F3.2)
//
//   Ticket    ที่ `assigneeId = me`   และยังไม่ปิด
//   Task      ที่ `assigneeId = me`   และยังไม่ done
//   TodoItem  ที่ `ownerId = me`
//
// เป็น union ฝั่งแอปพลิเคชัน ไม่ใช่ SQL UNION เพราะสามตารางนี้มีคอลัมน์ต่างกันคนละชุด
// การเรียงจึงทำในหน่วยความจำ — จำกัดด้วย `limit` (สูงสุด 200 รายการ) เพราะเป็น "งานของคนเดียว"
// ปริมาณจึงอยู่ในหลักสิบเสมอ ไม่ใช่รายงานทั้งระบบ

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/ticket-workflow"
import { myWorkQuerySchema } from "@/lib/worklog-schema"
import { compareWorkItems, isDueToday, isOverdue, type WorkItem } from "@/lib/worklog-service"
import { thaiToday } from "@/lib/thai-date"
import { BOARD_STATUS_LABEL, type BoardStatus } from "@/lib/task-board"

/// ดึงมาเผื่อไว้มากกว่า limit เล็กน้อยต่อประเภท เพื่อให้การเรียงรวมได้ผลถูกต้อง
/// ก่อนตัดตาม limit จริง (ถ้าดึงมาแค่ limit/3 งานด่วนของประเภทหนึ่งอาจตกหล่น)
const PER_KIND_TAKE = 200

export async function GET(request: NextRequest) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = myWorkQuerySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const query = parsed.data

    // state=done ต้องดึงงานที่จบแล้วมาด้วย ส่วน state อื่นสนใจเฉพาะงานที่ยังค้าง
    const includeDone = query.state === "done"
    const search = query.q ? { contains: query.q, mode: "insensitive" as const } : undefined

    try {
        const [tickets, tasks, todos] = await Promise.all([
            prisma.ticket.findMany({
                where: {
                    assigneeId: user.id,
                    status: includeDone
                        ? { in: ["resolved", "closed"] }
                        : { notIn: ["resolved", "closed"] },
                    ...(search ? { title: search } : {}),
                },
                select: {
                    id: true,
                    ticketNo: true,
                    title: true,
                    status: true,
                    priority: true,
                    resolutionDueAt: true,
                    updatedAt: true,
                    category: { select: { name: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: PER_KIND_TAKE,
            }),
            prisma.task.findMany({
                where: {
                    assigneeId: user.id,
                    boardStatus: includeDone ? "done" : { not: "done" },
                    ...(search ? { title: search } : {}),
                },
                select: {
                    id: true,
                    title: true,
                    boardStatus: true,
                    priority: true,
                    dueDate: true,
                    updatedAt: true,
                    projectId: true,
                    project: { select: { code: true, name: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: PER_KIND_TAKE,
            }),
            prisma.todoItem.findMany({
                where: {
                    ownerId: user.id,
                    isDone: includeDone,
                    ...(search ? { title: search } : {}),
                },
                select: {
                    id: true,
                    title: true,
                    note: true,
                    priority: true,
                    dueDate: true,
                    isDone: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
                take: PER_KIND_TAKE,
            }),
        ])

        const ticketItems: WorkItem[] = tickets.map((t) => ({
            kind: "ticket",
            id: t.id,
            title: t.title,
            code: t.ticketNo,
            status: TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status,
            priority: t.priority,
            dueDate: t.resolutionDueAt?.toISOString() ?? null,
            isDone: t.status === "resolved" || t.status === "closed",
            href: `/service/tickets/${t.id}`,
            context: t.category.name,
            updatedAt: t.updatedAt.toISOString(),
        }))

        const taskItems: WorkItem[] = tasks.map((t) => ({
            kind: "task",
            id: t.id,
            title: t.title,
            code: t.project.code,
            status: BOARD_STATUS_LABEL[t.boardStatus as BoardStatus] ?? t.boardStatus,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString() ?? null,
            isDone: t.boardStatus === "done",
            // การ์ดไม่มีหน้าของตัวเอง — เปิดกระดานของโครงการแล้วให้หน้าจอกางการ์ดนั้นให้ (F5.7)
            href: `/management/projects/${t.projectId}?task=${t.id}`,
            context: t.project.name,
            updatedAt: t.updatedAt.toISOString(),
        }))

        const todoItems: WorkItem[] = todos.map((t) => ({
            kind: "todo",
            id: t.id,
            title: t.title,
            code: null,
            status: t.isDone ? "เสร็จแล้ว" : "ค้างอยู่",
            priority: t.priority,
            dueDate: t.dueDate?.toISOString() ?? null,
            isDone: t.isDone,
            href: null,
            context: t.note,
            updatedAt: t.updatedAt.toISOString(),
        }))

        const all = [...ticketItems, ...taskItems, ...todoItems]
        const now = new Date()
        const today = thaiToday()

        // นับจากชุดเต็มก่อนกรอง เพื่อให้ตัวเลขบนแท็บไม่เปลี่ยนตามแท็บที่เลือกอยู่
        const counts = {
            all: all.length,
            ticket: ticketItems.length,
            task: taskItems.length,
            todo: todoItems.length,
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
