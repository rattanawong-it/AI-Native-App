"use client"

// กระดาน Kanban 5 คอลัมน์ + ลากย้ายการ์ดด้วย @dnd-kit
// อ้างอิง F5.4 (Backlog → To Do → Doing → Review → Done) และ F5.5 (drag & drop)
//
// การลากจะอัปเดตหน้าจอทันทีแล้วค่อยยิง API — ถ้า API ไม่ผ่าน ตัวเรียกจะโหลดกระดานใหม่
// ทำให้ลำดับกลับไปตรงกับฐานข้อมูลเอง (optimistic update + refetch on failure)
//
// ฝั่งเซิร์ฟเวอร์รับ "การ์ดที่จะให้ไปแทรกก่อนหน้า" ไม่ใช่เลขลำดับ เพราะเลขลำดับที่หน้าจอ
// คำนวณเองจะชนกันทันทีเมื่อมีคนสองคนลากพร้อมกัน

import { useMemo, useState } from "react"
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    closestCorners,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { GripVertical, MessageSquare, Clock, Ticket as TicketIcon, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PriorityBadge, PersonChip } from "@/components/ticket/ticket-badges"
import {
    BOARD_STATUSES,
    BOARD_STATUS_DOT,
    BOARD_STATUS_HINT,
    BOARD_STATUS_LABEL,
    SORT_STEP,
    type BoardStatus,
} from "@/lib/task-board"
import { formatThaiDate } from "@/lib/ticket-types"
import { isTaskOverdue, type TaskCard } from "@/lib/project-types"

export interface MovePayload {
    taskId: string
    boardStatus: BoardStatus
    /// การ์ดที่จะให้ไปแทรกก่อนหน้า — null = ต่อท้ายคอลัมน์
    beforeTaskId: string | null
    /// รายการการ์ดหลังย้ายแล้ว สำหรับอัปเดตหน้าจอทันที
    nextTasks: TaskCard[]
}

interface Props {
    tasks: TaskCard[]
    onMove: (payload: MovePayload) => void
    onOpen: (task: TaskCard) => void
    /// ลากได้ไหม — เจ้าหน้าที่ลากได้เฉพาะงานของตัวเอง (spec §7)
    canDrag: (task: TaskCard) => boolean
}

const bySortOrder = (a: TaskCard, b: TaskCard) =>
    a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)

export default function KanbanBoard({ tasks, onMove, onOpen, canDrag }: Props) {
    const [dragging, setDragging] = useState<TaskCard | null>(null)

    const columns = useMemo(
        () =>
            BOARD_STATUSES.map((status) => ({
                status,
                items: tasks.filter((t) => t.boardStatus === status).sort(bySortOrder),
            })),
        [tasks]
    )

    const sensors = useSensors(
        // ต้องลากให้ขยับ 6px ก่อนถึงจะเริ่มลาก ไม่งั้นคลิกเปิดการ์ดจะกลายเป็นการลากทุกครั้ง
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setDragging(tasks.find((t) => t.id === event.active.id) ?? null)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setDragging(null)
        const { active, over } = event
        if (!over) return

        const task = tasks.find((t) => t.id === active.id)
        if (!task) return

        // ปล่อยบนคอลัมน์ว่าง → id ของ droppable เป็น "col:<สถานะ>" · ปล่อยบนการ์ด → id คือ id ของการ์ด
        const overId = String(over.id)
        const overTask = tasks.find((t) => t.id === overId)
        const targetStatus = (
            overId.startsWith("col:") ? overId.slice(4) : (overTask?.boardStatus ?? task.boardStatus)
        ) as BoardStatus
        if (!(BOARD_STATUSES as readonly string[]).includes(targetStatus)) return

        // ลำดับใหม่ของคอลัมน์ปลายทาง = รายการเดิม (ไม่นับการ์ดที่ลาก) แล้วแทรกการ์ดลงตำแหน่งที่ปล่อย
        const target = tasks
            .filter((t) => t.boardStatus === targetStatus && t.id !== task.id)
            .sort(bySortOrder)

        const insertAt =
            overTask && overTask.id !== task.id
                ? target.findIndex((t) => t.id === overTask.id)
                : target.length
        const index = insertAt < 0 ? target.length : insertAt

        const reordered = [...target.slice(0, index), task, ...target.slice(index)]
        const beforeTaskId = reordered[index + 1]?.id ?? null

        // ไม่มีอะไรเปลี่ยน — ปล่อยที่เดิมในคอลัมน์เดิม
        if (targetStatus === task.boardStatus) {
            const current = tasks.filter((t) => t.boardStatus === targetStatus).sort(bySortOrder)
            if (current.findIndex((t) => t.id === task.id) === index) return
        }

        // เขียนเลขลำดับใหม่ให้ทั้งคอลัมน์ปลายทาง เพื่อให้การเรียงบนหน้าจอตรงกับที่ตาเห็นทันที
        const renumbered = new Map(reordered.map((t, i) => [t.id, (i + 1) * SORT_STEP]))
        const nextTasks = tasks.map((t) => {
            if (t.id === task.id) {
                return {
                    ...t,
                    boardStatus: targetStatus,
                    sortOrder: renumbered.get(t.id) ?? t.sortOrder,
                }
            }
            return renumbered.has(t.id) ? { ...t, sortOrder: renumbered.get(t.id)! } : t
        })

        onMove({ taskId: task.id, boardStatus: targetStatus, beforeTaskId, nextTasks })
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[1100px] grid-cols-5 gap-4">
                    {columns.map((col) => (
                        <Column
                            key={col.status}
                            status={col.status}
                            items={col.items}
                            onOpen={onOpen}
                            canDrag={canDrag}
                        />
                    ))}
                </div>
            </div>

            {/* การ์ดที่ลอยตามเมาส์ระหว่างลาก */}
            <DragOverlay>
                {dragging ? <CardBody task={dragging} dragging /> : null}
            </DragOverlay>
        </DndContext>
    )
}

// ── คอลัมน์ ──────────────────────────────────────────────────────────

function Column({
    status,
    items,
    onOpen,
    canDrag,
}: {
    status: BoardStatus
    items: TaskCard[]
    onOpen: (task: TaskCard) => void
    canDrag: (task: TaskCard) => boolean
}) {
    // ต้องมี droppable ของคอลัมน์เองด้วย ไม่งั้นคอลัมน์ที่ไม่มีการ์ดจะรับการปล่อยไม่ได้
    const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` })

    return (
        <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                    <span
                        className={cn("size-2 rounded-full", BOARD_STATUS_DOT[status])}
                        aria-hidden
                    />
                    {BOARD_STATUS_LABEL[status]}
                </span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    {items.length}
                </span>
            </div>
            <p className="text-muted-foreground mb-2 px-1 text-xs">{BOARD_STATUS_HINT[status]}</p>

            <div
                ref={setNodeRef}
                className={cn(
                    "bg-muted/40 flex min-h-[420px] flex-1 flex-col gap-2 rounded-lg p-2 transition-colors",
                    isOver && "bg-brand-tint/60 ring-brand/30 ring-2"
                )}
            >
                <SortableContext
                    items={items.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {items.map((task) => (
                        <SortableCard
                            key={task.id}
                            task={task}
                            onOpen={onOpen}
                            disabled={!canDrag(task)}
                        />
                    ))}
                </SortableContext>

                {items.length === 0 && (
                    <p className="text-muted-foreground py-8 text-center text-xs">
                        ลากการ์ดมาวางที่นี่
                    </p>
                )}
            </div>
        </div>
    )
}

// ── การ์ด ────────────────────────────────────────────────────────────

function SortableCard({
    task,
    onOpen,
    disabled,
}: {
    task: TaskCard
    onOpen: (task: TaskCard) => void
    disabled: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        disabled,
    })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cn(isDragging && "opacity-40")}
        >
            <CardBody
                task={task}
                onOpen={() => onOpen(task)}
                handleProps={disabled ? undefined : { ...attributes, ...listeners }}
                locked={disabled}
            />
        </div>
    )
}

function CardBody({
    task,
    onOpen,
    handleProps,
    dragging = false,
    locked = false,
}: {
    task: TaskCard
    onOpen?: () => void
    handleProps?: Record<string, unknown>
    dragging?: boolean
    locked?: boolean
}) {
    const overdue = isTaskOverdue(task)

    return (
        <div
            className={cn(
                "bg-card space-y-2.5 rounded-lg border p-3 shadow-sm",
                dragging && "ring-brand/40 rotate-1 ring-2"
            )}
        >
            <div className="flex items-start gap-2">
                {/* จับตรงนี้เพื่อลาก — แยกจากตัวการ์ดเพื่อให้คลิกเปิดรายละเอียดได้ตามปกติ */}
                <button
                    type="button"
                    {...handleProps}
                    disabled={locked}
                    className={cn(
                        "text-muted-foreground mt-0.5 shrink-0",
                        locked ? "cursor-not-allowed opacity-30" : "cursor-grab active:cursor-grabbing"
                    )}
                    title={locked ? "ลากได้เฉพาะงานที่คุณรับผิดชอบ" : "ลากเพื่อย้ายคอลัมน์"}
                >
                    <GripVertical className="size-4" />
                    <span className="sr-only">ลากการ์ด</span>
                </button>

                <button
                    type="button"
                    onClick={onOpen}
                    className="min-w-0 flex-1 text-left text-sm font-medium hover:underline"
                >
                    {task.title}
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={task.priority} />
                {task.sourceTicket && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <TicketIcon className="size-3" />
                        {task.sourceTicket.ticketNo}
                    </span>
                )}
            </div>

            {task.dueDate && (
                <p
                    className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                        overdue ? "text-priority-critical font-medium" : "text-muted-foreground"
                    )}
                >
                    {overdue ? (
                        <AlertTriangle className="size-3.5" />
                    ) : (
                        <Clock className="size-3.5" />
                    )}
                    {overdue ? "เลยกำหนด " : "กำหนด "}
                    {formatThaiDate(task.dueDate)}
                </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t pt-2">
                <PersonChip person={task.assignee} size={22} />
                <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                    {task.estimateHours !== null && <span>{task.estimateHours} ชม.</span>}
                    {task._count.comments > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <MessageSquare className="size-3.5" />
                            {task._count.comments}
                        </span>
                    )}
                </span>
            </div>
        </div>
    )
}
