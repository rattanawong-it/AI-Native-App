// lib/project-service.ts
// ตรรกะกลางของกลุ่ม SDLC ที่ API หลายเส้นใช้ร่วมกัน
//   - select ของ Project / Sprint / Task / Team ที่ส่งให้ UI
//   - แปลง Decimal(6,2) เป็น number ก่อนส่งออก JSON
//   - คำนวณ progress ของโครงการจากสัดส่วน Task ที่ done (F5.10)
//   - จัดลำดับการ์ดบนกระดานเมื่อมีการลากย้าย (F5.5)
//   - สรุป Sprint สำหรับ burndown (F5.12)
// อ้างอิง docs/spec.md §5.4, §7 (RBAC) และ §8 ⑤

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { isManager, type AuthUser } from "@/lib/rbac"
import { BOARD_STATUSES, SORT_STEP, progressFrom, type BoardStatus } from "@/lib/task-board"
import { STAFF_ROLES } from "@/lib/roles"

const personSelect = { id: true, name: true, email: true, image: true } as const

// ── select ที่ใช้ซ้ำ ─────────────────────────────────────────────────

export const projectListSelect = {
    id: true,
    code: true,
    name: true,
    description: true,
    status: true,
    ownerId: true,
    teamId: true,
    startDate: true,
    endDate: true,
    progress: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: personSelect },
    team: { select: { id: true, name: true, _count: { select: { members: true } } } },
    _count: { select: { tasks: true, sprints: true } },
} satisfies Prisma.ProjectSelect

export type ProjectListRow = Prisma.ProjectGetPayload<{ select: typeof projectListSelect }>

export const sprintSelect = {
    id: true,
    projectId: true,
    name: true,
    goal: true,
    startDate: true,
    endDate: true,
    status: true,
    sortOrder: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { tasks: true } },
} satisfies Prisma.SprintSelect

export type SprintRow = Prisma.SprintGetPayload<{ select: typeof sprintSelect }>

/// การ์ดบนกระดาน — เอาเฉพาะที่ต้องแสดงบนหน้าการ์ด ไม่ดึงรายละเอียดยาว
export const taskCardSelect = {
    id: true,
    projectId: true,
    sprintId: true,
    title: true,
    boardStatus: true,
    priority: true,
    assigneeId: true,
    estimateHours: true,
    dueDate: true,
    sortOrder: true,
    sourceTicketId: true,
    createdAt: true,
    updatedAt: true,
    assignee: { select: personSelect },
    sourceTicket: { select: { id: true, ticketNo: true, title: true } },
    _count: { select: { comments: true, workLogs: true } },
} satisfies Prisma.TaskSelect

export type TaskCardRow = Prisma.TaskGetPayload<{ select: typeof taskCardSelect }>

export const taskDetailSelect = {
    ...taskCardSelect,
    description: true,
    createdBy: true,
    project: { select: { id: true, code: true, name: true, status: true } },
    sprint: { select: { id: true, name: true, status: true } },
} satisfies Prisma.TaskSelect

export type TaskDetailRow = Prisma.TaskGetPayload<{ select: typeof taskDetailSelect }>

export const taskCommentSelect = {
    id: true,
    taskId: true,
    body: true,
    createdAt: true,
    author: { select: personSelect },
} satisfies Prisma.TaskCommentSelect

export type TaskCommentRow = Prisma.TaskCommentGetPayload<{ select: typeof taskCommentSelect }>

export const teamSelect = {
    id: true,
    name: true,
    description: true,
    leaderId: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    leader: { select: personSelect },
    members: {
        select: {
            id: true,
            userId: true,
            roleInTeam: true,
            joinedAt: true,
            user: { select: { ...personSelect, position: true } },
        },
        orderBy: [{ roleInTeam: "asc" }, { joinedAt: "asc" }],
    },
    _count: { select: { members: true, projects: true, tickets: true } },
} satisfies Prisma.TeamSelect

export type TeamRow = Prisma.TeamGetPayload<{ select: typeof teamSelect }>

// ── แปลงค่าก่อนส่งออก JSON ──────────────────────────────────────────

/// Decimal ของ Prisma ผ่าน JSON.stringify แล้วได้ object ไม่ใช่ตัวเลข จึงต้องแปลงเองทุกครั้ง
/// (ต่างจาก `decimalToNumber` ของ worklog ตรงที่ null ต้องคงเป็น null ไม่ใช่ 0 —
///  "ยังไม่ได้ประมาณชั่วโมง" กับ "ประมาณไว้ 0 ชม." คนละความหมายกัน)
export function decimalOrNull(value: Prisma.Decimal | number | string | null): number | null {
    if (value === null) return null
    const n = typeof value === "number" ? value : Number(value.toString())
    return Number.isFinite(n) ? n : null
}

export function toTaskCardDto(row: TaskCardRow, loggedHours = 0) {
    return {
        ...row,
        estimateHours: decimalOrNull(row.estimateHours),
        /// ชั่วโมงที่ลงเวลาไว้จริงกับงานใบนี้ (จาก `WorkLog` ของเฟส 3)
        loggedHours,
        dueDate: row.dueDate?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }
}

export function toTaskDetailDto(row: TaskDetailRow, loggedHours = 0) {
    return {
        ...toTaskCardDto(row, loggedHours),
        description: row.description,
        createdBy: row.createdBy,
        project: row.project,
        sprint: row.sprint,
    }
}

// ── ชั่วโมงที่ลงจริง (เชื่อมกับ Time Log ของเฟส 3) ────────────────────

/// รวมชั่วโมงจาก `WorkLog` ของหลายงานในคิวรีเดียว แล้วคืนเป็นแผนที่ id → ชั่วโมง
///
/// แยกออกมาเป็นคิวรีต่างหากแทนการใส่ใน select เพราะ Prisma รวมค่าใน `select` ไม่ได้
/// และการดึง WorkLog ทุกแถวมานับเองจะหนักเกินจำเป็นเมื่อกระดานมีการ์ดหลายสิบใบ
export async function loggedHoursByTask(taskIds: string[]): Promise<Map<string, number>> {
    if (taskIds.length === 0) return new Map()

    const rows = await prisma.workLog.groupBy({
        by: ["taskId"],
        where: { taskId: { in: taskIds } },
        _sum: { hours: true },
    })

    const map = new Map<string, number>()
    for (const r of rows) {
        if (r.taskId) map.set(r.taskId, decimalOrNull(r._sum.hours) ?? 0)
    }
    return map
}

/// แปลงการ์ดทั้งชุดพร้อมเติมชั่วโมงที่ลงจริง — ใช้กับทุกเส้นที่คืนรายการงาน
export async function toTaskCardDtos(rows: TaskCardRow[]) {
    const logged = await loggedHoursByTask(rows.map((r) => r.id))
    return rows.map((r) => toTaskCardDto(r, logged.get(r.id) ?? 0))
}

/// ชั่วโมงที่ลงจริงของงานใบเดียว
export async function loggedHoursOf(taskId: string): Promise<number> {
    const map = await loggedHoursByTask([taskId])
    return map.get(taskId) ?? 0
}

// ── สิทธิ์ (spec §7) ─────────────────────────────────────────────────
//
// | บทบาท   | โครงการ / Sprint / ทีม | Task                          |
// |---------|------------------------|-------------------------------|
// | agent   | อ่านอย่างเดียว          | แก้/ลากได้เฉพาะงานของตัวเอง    |
// | manager | จัดการได้ทั้งหมด        | จัดการได้ทั้งหมด               |
// | admin   | จัดการได้ทั้งหมด        | จัดการได้ทั้งหมด               |

/// role ที่เปิดให้เข้าถึงกลุ่ม SDLC ได้ — ใช้เป็นชุดเดียวกันทุก route
/// อ้าง STAFF_ROLES เพื่อไม่ให้เพี้ยนจาก sidebar และ middleware (docs/spec.md §7.2 กลุ่ม 6)
export const SDLC_ROLES = STAFF_ROLES

/// สร้าง/แก้ไข/ลบ โครงการ Sprint และทีม — หัวหน้าขึ้นไปเท่านั้น
export function canManageProject(user: AuthUser): boolean {
    return isManager(user)
}

/// แก้ไข Task ได้ไหม — หัวหน้าขึ้นไปแก้ได้ทุกใบ, เจ้าหน้าที่แก้ได้เฉพาะงานที่ตัวเองถือ
export function canUpdateTask(user: AuthUser, task: { assigneeId: string | null }): boolean {
    if (isManager(user)) return true
    return task.assigneeId === user.id
}

// ── ความคืบหน้าโครงการ (F5.10) ───────────────────────────────────────

/// คำนวณ progress ใหม่จากสัดส่วน Task ที่อยู่คอลัมน์ done แล้วเขียนกลับลงโครงการ
///
/// เรียกหลังทุกการกระทำที่เปลี่ยนจำนวนหรือสถานะของ Task (สร้าง / ย้าย / แก้ / ลบ)
/// กลืน error ไว้เอง เพราะตัวเลขคืบหน้าไม่ควรทำให้การบันทึกงานหลักล้มเหลว
export async function recalcProjectProgress(projectId: string): Promise<number | null> {
    try {
        const [total, done] = await Promise.all([
            prisma.task.count({ where: { projectId } }),
            prisma.task.count({ where: { projectId, boardStatus: "done" } }),
        ])
        const progress = progressFrom(done, total)
        await prisma.project.update({ where: { id: projectId }, data: { progress } })
        return progress
    } catch (error) {
        console.error("recalcProjectProgress Error:", error)
        return null
    }
}

// ── ลำดับการ์ดบนกระดาน (F5.5) ────────────────────────────────────────

/// คีย์ของ "คอลัมน์เดียวกัน" — การ์ดจะเรียงลำดับเทียบกันเฉพาะภายในคอลัมน์ของ Sprint เดียวกัน
export interface ColumnKey {
    projectId: string
    boardStatus: BoardStatus
    sprintId: string | null
}

function columnWhere(key: ColumnKey): Prisma.TaskWhereInput {
    return {
        projectId: key.projectId,
        boardStatus: key.boardStatus,
        sprintId: key.sprintId,
    }
}

/// ลำดับถัดไปเมื่อวางต่อท้ายคอลัมน์
export async function nextSortOrder(key: ColumnKey): Promise<number> {
    const last = await prisma.task.findFirst({
        where: columnWhere(key),
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
    })
    return (last?.sortOrder ?? 0) + SORT_STEP
}

/// คำนวณ `sortOrder` ใหม่ของการ์ดที่ถูกลากมาวาง
///
/// วิธีคิด: แทรกค่ากึ่งกลางระหว่างการ์ดบนกับการ์ดล่างของตำแหน่งที่วาง — ไม่ต้องเขียนทับทั้งคอลัมน์
/// ถ้าช่องว่างแคบเกินจนหาค่ากลางไม่ได้ (ลากสลับกันหลายรอบจนตัวเลขติดกัน) จะจัดเลขคอลัมน์ใหม่
/// ทั้งคอลัมน์หนึ่งครั้ง แล้วค่อยแทรก — เกิดไม่บ่อย แต่ต้องรองรับไม่งั้นลำดับจะเพี้ยน
export async function sortOrderForMove(
    taskId: string,
    key: ColumnKey,
    beforeTaskId: string | null
): Promise<number> {
    // การ์ดในคอลัมน์ปลายทาง (ไม่นับตัวที่กำลังลาก เพราะกำลังจะย้ายที่)
    const siblings = await prisma.task.findMany({
        where: { ...columnWhere(key), id: { not: taskId } },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
    })

    if (siblings.length === 0) return SORT_STEP

    // วางต่อท้าย
    if (!beforeTaskId) return siblings[siblings.length - 1].sortOrder + SORT_STEP

    const index = siblings.findIndex((s) => s.id === beforeTaskId)
    // อ้างถึงการ์ดที่ไม่ได้อยู่ในคอลัมน์นี้ (หน้าจอค้างข้อมูลเก่า) — ถือว่าวางต่อท้าย
    if (index < 0) return siblings[siblings.length - 1].sortOrder + SORT_STEP

    const after = siblings[index].sortOrder
    const before = index === 0 ? after - SORT_STEP * 2 : siblings[index - 1].sortOrder

    if (after - before >= 2) return Math.floor((before + after) / 2)

    // ช่องว่างหมด — จัดเลขใหม่ทั้งคอลัมน์แล้วแทรกลงช่องที่เว้นไว้
    await prisma.$transaction(
        siblings.map((s, i) =>
            prisma.task.update({
                where: { id: s.id },
                data: { sortOrder: (i + 1) * SORT_STEP },
            })
        )
    )
    return index === 0 ? Math.floor(SORT_STEP / 2) : index * SORT_STEP + Math.floor(SORT_STEP / 2)
}

// ── กระดาน + สรุป Sprint (F5.4, F5.12) ───────────────────────────────

/// จำนวนการ์ดแยกตามคอลัมน์ — คืนครบ 5 คอลัมน์เสมอ แม้คอลัมน์ที่ไม่มีงาน
export function emptyBoardCount(): Record<BoardStatus, number> {
    return Object.fromEntries(BOARD_STATUSES.map((s) => [s, 0])) as Record<BoardStatus, number>
}

export interface BoardSummary {
    counts: Record<BoardStatus, number>
    total: number
    done: number
    progress: number
    /// ชั่วโมงที่ประมาณไว้รวม และส่วนที่ปิดงานแล้ว — ใช้เป็นเส้น burndown อย่างง่าย (F5.12)
    estimateTotal: number
    estimateDone: number
    /// ชั่วโมงที่ลงเวลาไว้จริงรวม — เทียบกับที่ประมาณไว้เพื่อดูว่าประเมินแม่นแค่ไหน
    loggedTotal: number
}

/// ปัดเป็นทศนิยม 2 ตำแหน่ง — กันเศษทศนิยมลอยจากการบวก float
function round2(value: number): number {
    return Math.round(value * 100) / 100
}

/// สรุปกระดานจากรายการการ์ดที่ดึงมาแล้ว — ไม่ยิงคิวรีเพิ่ม
export function summarizeBoard(
    tasks: { boardStatus: string; estimateHours: number | null; loggedHours?: number }[]
): BoardSummary {
    const counts = emptyBoardCount()
    let estimateTotal = 0
    let estimateDone = 0
    let loggedTotal = 0

    for (const t of tasks) {
        const status = t.boardStatus as BoardStatus
        if (status in counts) counts[status] += 1
        const hours = t.estimateHours ?? 0
        estimateTotal += hours
        if (status === "done") estimateDone += hours
        loggedTotal += t.loggedHours ?? 0
    }

    const total = tasks.length
    const done = counts.done
    return {
        counts,
        total,
        done,
        progress: progressFrom(done, total),
        estimateTotal: round2(estimateTotal),
        estimateDone: round2(estimateDone),
        loggedTotal: round2(loggedTotal),
    }
}

// ── ตัวช่วยตรวจความสัมพันธ์ก่อนบันทึก ────────────────────────────────

/// Sprint ที่อ้างถึงต้องอยู่ในโครงการเดียวกัน — กัน id ข้ามโครงการจากภายนอก
/// คืน `null` เมื่อผ่าน · คืนข้อความไทยเมื่อไม่ผ่าน (เอาไปใส่ badRequest ได้เลย)
export async function validateSprintOfProject(
    projectId: string,
    sprintId: string | null | undefined
): Promise<string | null> {
    if (!sprintId) return null
    const sprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
        select: { projectId: true },
    })
    if (!sprint) return "ไม่พบ Sprint ที่เลือก"
    if (sprint.projectId !== projectId) return "Sprint ที่เลือกไม่ได้อยู่ในโครงการนี้"
    return null
}

/// ผู้รับผิดชอบต้องเป็นผู้ใช้ที่มีอยู่จริง
export async function validateAssignee(assigneeId: string | null | undefined): Promise<string | null> {
    if (!assigneeId) return null
    const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } })
    return user ? null : "ไม่พบผู้ใช้ที่เลือกเป็นผู้รับผิดชอบ"
}
