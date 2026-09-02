// lib/worklog-service.ts
// ตรรกะกลางของ My Work / To-do / Time Log ที่ API หลายเส้นใช้ร่วมกัน
//   - select ของ TodoItem / WorkLog ที่ส่งให้ UI
//   - แปลง Decimal(5,2) เป็น number ก่อนส่งออก JSON
//   - รวมงาน 3 ประเภทเป็นรายการเดียว แล้วเรียงตามกำหนดส่ง (F3.1, F3.2)
//   - สรุปชั่วโมงทำงานรายวัน/สัปดาห์/เดือน (F3.7, F3.8)
// อ้างอิง docs/spec.md §5.3, §8 ③

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { canAccessTicket, type AuthUser } from "@/lib/rbac"
import { PRIORITY_WEIGHT, type Priority } from "@/lib/priority"
import { WORKLOG_REF_LABEL, type WorkLogRefType } from "@/lib/worklog-schema"
import {
    addThaiDays,
    endOfThaiMonth,
    startOfThaiMonth,
    startOfThaiWeek,
    thaiDayKey,
} from "@/lib/thai-date"

const personSelect = { id: true, name: true, email: true, image: true } as const

// ── TodoItem (F3.3) ──────────────────────────────────────────────────

export const todoSelect = {
    id: true,
    ownerId: true,
    title: true,
    note: true,
    dueDate: true,
    priority: true,
    isDone: true,
    doneAt: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { workLogs: true } },
} satisfies Prisma.TodoItemSelect

export type TodoRow = Prisma.TodoItemGetPayload<{ select: typeof todoSelect }>

// ── WorkLog (F3.5) ───────────────────────────────────────────────────

export const workLogSelect = {
    id: true,
    userId: true,
    workDate: true,
    hours: true,
    description: true,
    refType: true,
    ticketId: true,
    taskId: true,
    todoId: true,
    createdAt: true,
    user: { select: personSelect },
    ticket: { select: { id: true, ticketNo: true, title: true } },
    task: { select: { id: true, title: true } },
    todo: { select: { id: true, title: true } },
} satisfies Prisma.WorkLogSelect

export type WorkLogRow = Prisma.WorkLogGetPayload<{ select: typeof workLogSelect }>

/// รูปร่างที่ส่งออกทาง JSON — `hours` เป็น number และ `workDate` เป็น "YYYY-MM-DD"
export interface WorkLogDto {
    id: string
    userId: string
    workDate: string
    hours: number
    description: string
    refType: string
    refLabel: string
    /// ชื่อของงานที่ผูกไว้ เช่น "TK-2609-0001 · เน็ตใช้ไม่ได้" — null เมื่อ refType = other
    refTitle: string | null
    /// ลิงก์ไปหน้ารายละเอียดของงานนั้น (ถ้ามีหน้าให้ไป)
    refHref: string | null
    ticketId: string | null
    taskId: string | null
    todoId: string | null
    createdAt: string
    user: { id: string; name: string; email: string; image: string | null }
}

/// Decimal ของ Prisma ผ่าน JSON.stringify แล้วได้ object ไม่ใช่ตัวเลข จึงต้องแปลงเองทุกครั้ง
export function decimalToNumber(value: Prisma.Decimal | number | string | null): number {
    if (value === null) return 0
    const n = typeof value === "number" ? value : Number(value.toString())
    return Number.isFinite(n) ? n : 0
}

/// คอลัมน์ `workDate` เป็น @db.Date (เที่ยงคืน UTC) จึงอ่านเป็น ISO ตรงๆ ได้ ไม่ต้องบวกออฟเซ็ต
export function workDateKey(date: Date): string {
    return date.toISOString().slice(0, 10)
}

export function toWorkLogDto(row: WorkLogRow): WorkLogDto {
    const refType = row.refType as WorkLogRefType
    const refTitle =
        row.ticket !== null
            ? `${row.ticket.ticketNo} · ${row.ticket.title}`
            : (row.task?.title ?? row.todo?.title ?? null)

    return {
        id: row.id,
        userId: row.userId,
        workDate: workDateKey(row.workDate),
        hours: decimalToNumber(row.hours),
        description: row.description,
        refType: row.refType,
        refLabel: WORKLOG_REF_LABEL[refType] ?? row.refType,
        refTitle,
        refHref: row.ticketId ? `/service/tickets/${row.ticketId}` : null,
        ticketId: row.ticketId,
        taskId: row.taskId,
        todoId: row.todoId,
        createdAt: row.createdAt.toISOString(),
        user: row.user,
    }
}

/// ตรวจว่างานที่จะผูกกับบันทึกเวลามีจริง และผู้ใช้มีสิทธิ์แตะงานนั้น
///
/// zod ตรวจแค่ว่า `refType` มากับ id ครบคู่ ส่วนนี้ตรวจกับฐานข้อมูลจริง — กัน id มั่วจากภายนอก
/// คืน `null` เมื่อผ่าน · คืนข้อความไทยเมื่อไม่ผ่าน (เอาไปใส่ badRequest ได้เลย)
export async function validateWorkLogRef(
    user: AuthUser,
    input: {
        refType: string
        ticketId?: string | null
        taskId?: string | null
        todoId?: string | null
    }
): Promise<string | null> {
    if (input.refType === "ticket" && input.ticketId) {
        const ticket = await prisma.ticket.findUnique({
            where: { id: input.ticketId },
            select: { id: true, requesterId: true, assigneeId: true },
        })
        if (!ticket) return "ไม่พบ Ticket ที่ต้องการผูก"
        if (!canAccessTicket(user, ticket)) return "คุณไม่มีสิทธิ์เข้าถึง Ticket ใบนี้"
    }

    if (input.refType === "task" && input.taskId) {
        const task = await prisma.task.findUnique({
            where: { id: input.taskId },
            select: { id: true },
        })
        if (!task) return "ไม่พบ Task ที่ต้องการผูก"
    }

    if (input.refType === "todo" && input.todoId) {
        const todo = await prisma.todoItem.findUnique({
            where: { id: input.todoId },
            select: { id: true, ownerId: true },
        })
        if (!todo) return "ไม่พบงานส่วนตัวที่ต้องการผูก"
        if (todo.ownerId !== user.id) return "ผูกได้เฉพาะงานส่วนตัวของตัวเอง"
    }

    return null
}

// ── My Work — รายการงานรวม 3 ประเภท (F3.1, F3.2) ─────────────────────

/// งานหนึ่งชิ้นในมุมมองรวม ไม่ว่าจะมาจาก Ticket, Task หรือ TodoItem
export interface WorkItem {
    kind: "ticket" | "task" | "todo"
    id: string
    title: string
    /// เลขที่ Ticket หรือรหัสโครงการ — ใช้แสดงเป็นตัวรอง
    code: string | null
    /// สถานะในภาษาของงานประเภทนั้น (ใช้ label ของแต่ละชนิด)
    status: string
    priority: string
    dueDate: string | null
    isDone: boolean
    href: string | null
    /// ข้อความบริบทเพิ่ม เช่น ชื่อหมวดหมู่ / ชื่อโครงการ
    context: string | null
    updatedAt: string
}

/// เรียงงานรวม: ยังไม่เสร็จมาก่อน → ครบกำหนดเร็วกว่ามาก่อน → priority สูงกว่ามาก่อน (F3.2)
///
/// งานที่ไม่มีกำหนดส่งถูกดันไปท้ายสุดของกลุ่ม เพราะไม่มีอะไรเร่ง
export function compareWorkItems(a: WorkItem, b: WorkItem): number {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1

    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    if (da !== db) return da - db

    const wa = PRIORITY_WEIGHT[a.priority as Priority] ?? 0
    const wb = PRIORITY_WEIGHT[b.priority as Priority] ?? 0
    if (wa !== wb) return wb - wa

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

/// เลยกำหนดแล้วหรือยัง — งานที่ทำเสร็จแล้วไม่ถือว่าเลยกำหนด
export function isOverdue(item: WorkItem, now: Date = new Date()): boolean {
    if (item.isDone || !item.dueDate) return false
    return new Date(item.dueDate).getTime() < now.getTime()
}

/// ครบกำหนดวันนี้ (ตามปฏิทินไทย) หรือไม่
export function isDueToday(item: WorkItem, todayIso: string): boolean {
    if (item.isDone || !item.dueDate) return false
    return thaiDayKey(new Date(item.dueDate)) === todayIso
}

// ── สรุปชั่วโมงทำงาน (F3.7, F3.8) ────────────────────────────────────

/// ช่วงวันที่ที่ใช้สรุป — คำนวณจากวันอ้างอิงหนึ่งวันกับหน่วยเวลาที่เลือก
export function summaryRange(dateIso: string, period: "day" | "week" | "month"): {
    from: string
    to: string
    label: string
} {
    if (period === "day") {
        return { from: dateIso, to: dateIso, label: "วันนี้" }
    }
    if (period === "week") {
        const from = startOfThaiWeek(dateIso)
        return { from, to: addThaiDays(from, 6), label: "สัปดาห์นี้" }
    }
    return { from: startOfThaiMonth(dateIso), to: endOfThaiMonth(dateIso), label: "เดือนนี้" }
}

/// ชั่วโมงรวมของกลุ่มหนึ่ง (วัน / ประเภทงาน / คน)
export interface HoursBucket {
    key: string
    label: string
    hours: number
    entries: number
}

/// รวมชั่วโมงเข้ากลุ่มตามคีย์ที่กำหนด แล้วคืนเป็น array เรียงตามคีย์
export function bucketHours(
    rows: { key: string; label: string; hours: number }[]
): HoursBucket[] {
    const map = new Map<string, HoursBucket>()
    for (const r of rows) {
        const bucket = map.get(r.key) ?? { key: r.key, label: r.label, hours: 0, entries: 0 }
        bucket.hours += r.hours
        bucket.entries += 1
        map.set(r.key, bucket)
    }
    return [...map.values()]
        .map((b) => ({ ...b, hours: roundHours(b.hours) }))
        .sort((a, b) => a.key.localeCompare(b.key))
}

/// ปัดเป็นทศนิยม 2 ตำแหน่ง — กันเศษทศนิยมลอยจากการบวก float
export function roundHours(value: number): number {
    return Math.round(value * 100) / 100
}

/// ทุกวันในช่วง (รวมวันที่ไม่มีบันทึก) เพื่อให้กราฟ/ตารางไม่ขาดช่วง
export function daysInRange(from: string, to: string, max = 62): string[] {
    const out: string[] = []
    let cursor = from
    while (cursor <= to && out.length < max) {
        out.push(cursor)
        cursor = addThaiDays(cursor, 1)
    }
    return out
}
