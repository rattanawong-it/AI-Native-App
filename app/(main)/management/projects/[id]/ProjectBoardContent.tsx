"use client"

// หน้าภาพรวมโครงการ + กระดาน Kanban
// อ้างอิง F5.2 (ภาพรวม + progress + สมาชิก), F5.3 (CRUD Sprint), F5.4/F5.5 (กระดาน + ลากย้าย),
//        F5.10 (progress อัตโนมัติ), F5.12 (สรุป Sprint) และ F5.13 (Backlog view)

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
    ArrowLeft,
    Plus,
    RefreshCw,
    Loader2,
    CalendarRange,
    ListChecks,
    Clock,
    Users,
    Pencil,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { PersonChip } from "@/components/ticket/ticket-badges"
import {
    ProgressBar,
    ProjectStatusBadge,
    SprintStatusBadge,
} from "@/components/project/project-badges"
import KanbanBoard, {
    type MovePayload,
    type SprintDropTarget,
} from "@/app/(main)/management/projects/[id]/KanbanBoard"
import TaskDialog, {
    type TaskDialogTarget,
} from "@/app/(main)/management/projects/[id]/TaskDialog"
import {
    BOARD_STATUSES,
    BOARD_STATUS_LABEL,
    SPRINT_STATUSES,
    SPRINT_STATUS_LABEL,
    type SprintStatus,
} from "@/lib/task-board"
import { formatThaiDate, readError, type Person } from "@/lib/ticket-types"
import {
    thaiDateRange,
    toDateInput,
    type BoardResponse,
    type ProjectDetail,
    type SprintRow,
    type TaskCard,
} from "@/lib/project-types"

/// ค่าที่เลือกได้บนแถบรอบพัฒนา — "all" = ทั้งโครงการ · "none" = Backlog (F5.13)
type SprintFilter = "all" | "none" | string

interface SprintFormState {
    id?: string
    name: string
    goal: string
    startDate: string
    endDate: string
    status: SprintStatus
}

const EMPTY_SPRINT: SprintFormState = {
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
    status: "planned",
}

export default function ProjectBoardContent({ projectId }: { projectId: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { data: session } = useSession()

    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canManage = roles.some((r) => ["manager", "admin"].includes(r))
    const currentUserId = session?.user?.id ?? null

    const [project, setProject] = useState<ProjectDetail | null>(null)
    const [tasks, setTasks] = useState<TaskCard[]>([])
    const [boardSprint, setBoardSprint] = useState<BoardResponse["sprint"]>(null)
    const [agents, setAgents] = useState<Person[]>([])
    const [sprintFilter, setSprintFilter] = useState<SprintFilter>("all")

    const [loading, setLoading] = useState(true)
    const [boardLoading, setBoardLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [taskTarget, setTaskTarget] = useState<TaskDialogTarget | null>(null)
    const [sprintForm, setSprintForm] = useState<SprintFormState | null>(null)

    // ── โหลดข้อมูล ──

    const fetchProject = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/projects/${projectId}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดข้อมูลโครงการได้"))
                return
            }
            const data = (await res.json()) as { project: ProjectDetail }
            setProject(data.project)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [projectId])

    const fetchBoard = useCallback(async () => {
        setBoardLoading(true)
        try {
            const params = new URLSearchParams()
            if (sprintFilter !== "all") params.set("sprintId", sprintFilter)
            const res = await fetch(`/api/projects/${projectId}/tasks?${params.toString()}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดกระดานงานได้"))
                return
            }
            const data = (await res.json()) as BoardResponse
            setTasks(data.tasks)
            setBoardSprint(data.sprint)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBoardLoading(false)
        }
    }, [projectId, sprintFilter])

    useEffect(() => {
        void fetchProject()
    }, [fetchProject])

    useEffect(() => {
        void fetchBoard()
    }, [fetchBoard])

    useEffect(() => {
        void (async () => {
            const res = await fetch("/api/directory?scope=agents")
            if (res.ok) {
                const data = (await res.json()) as { agents: Person[] }
                setAgents(data.agents)
            }
        })()
    }, [])

    // เปิดการ์ดที่ถูกลิงก์มาจากการแจ้งเตือนหรือหน้า My Work — /management/projects/<id>?task=<taskId>
    useEffect(() => {
        const taskId = searchParams.get("task")
        if (taskId) setTaskTarget({ id: taskId })
    }, [searchParams])

    const closeTaskDialog = () => {
        setTaskTarget(null)
        // ล้าง ?task= ออกจาก URL ไม่งั้นกดปิดแล้วกลับมาหน้าเดิมจะเด้งเปิดซ้ำ
        if (searchParams.get("task")) {
            router.replace(`/management/projects/${projectId}`, { scroll: false })
        }
    }

    // ── ลากย้ายการ์ด (F5.5) ──

    const handleMove = async ({ taskId, boardStatus, beforeTaskId, nextTasks }: MovePayload) => {
        const snapshot = tasks
        setTasks(nextTasks)

        try {
            const res = await fetch(`/api/tasks/${taskId}/move`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    boardStatus,
                    beforeTaskId,
                    // ลากภายในกระดานของรอบที่กำลังดู — คงรอบเดิมไว้เสมอ
                    ...(sprintFilter === "none" ? { sprintId: null } : {}),
                }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ย้ายงานไม่สำเร็จ"))
                setTasks(snapshot)
                return
            }
            const data = (await res.json()) as { progress: number | null }
            // เข้า/ออกคอลัมน์ "เสร็จแล้ว" ทำให้ทั้งความคืบหน้าและตัวเลขสรุปของโครงการเปลี่ยน
            // (F5.10) — ปรับทั้งสองอย่างพร้อมกัน ไม่งั้นการ์ด "งานที่ปิดแล้ว" จะค้างเลขเดิม
            if (data.progress !== null) {
                const moved = snapshot.find((t) => t.id === taskId)
                const wasDone = moved?.boardStatus === "done"
                const isDone = boardStatus === "done"
                const delta = isDone === wasDone ? 0 : isDone ? 1 : -1
                const hours = moved?.estimateHours ?? 0

                setProject((prev) =>
                    prev
                        ? {
                              ...prev,
                              progress: data.progress!,
                              doneTasks: prev.doneTasks + delta,
                              board: {
                                  ...prev.board,
                                  done: prev.board.done + delta,
                                  progress: data.progress!,
                                  estimateDone:
                                      Math.round((prev.board.estimateDone + delta * hours) * 100) /
                                      100,
                              },
                          }
                        : prev
                )
            }
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
            setTasks(snapshot)
        }
    }

    /// ลากการ์ดมาวางบนแถบรอบพัฒนา — ย้ายเข้า/ออกรอบโดยคงคอลัมน์เดิม (F5.13)
    const handleMoveToSprint = async (task: TaskCard, target: SprintDropTarget) => {
        if (task.sprintId === target.sprintId) return

        const snapshot = tasks
        // กำลังดูรอบเดียว = การ์ดที่ย้ายออกไปต้องหายจากกระดานทันที
        setTasks((prev) =>
            sprintFilter === "all"
                ? prev.map((t) => (t.id === task.id ? { ...t, sprintId: target.sprintId } : t))
                : prev.filter((t) => t.id !== task.id)
        )

        try {
            const res = await fetch(`/api/tasks/${task.id}/move`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    boardStatus: task.boardStatus,
                    sprintId: target.sprintId,
                }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ย้ายเข้ารอบพัฒนาไม่สำเร็จ"))
                setTasks(snapshot)
                return
            }
            toast.success(`ย้าย "${task.title}" เข้า ${target.label} แล้ว`)
            // ตัวนับงานของแต่ละรอบบนแถบด้านบนเปลี่ยน จึงต้องโหลดข้อมูลโครงการใหม่
            await fetchProject()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
            setTasks(snapshot)
        }
    }

    // ── Sprint (F5.3) ──

    const saveSprint = async () => {
        if (!sprintForm) return
        setBusy(true)
        try {
            const payload = {
                name: sprintForm.name,
                goal: sprintForm.goal.trim() || null,
                startDate: sprintForm.startDate,
                endDate: sprintForm.endDate,
                status: sprintForm.status,
            }
            const res = await fetch(
                sprintForm.id
                    ? `/api/projects/${projectId}/sprints/${sprintForm.id}`
                    : `/api/projects/${projectId}/sprints`,
                {
                    method: sprintForm.id ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            )
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกรอบพัฒนาไม่สำเร็จ"))
                return
            }
            toast.success(sprintForm.id ? "บันทึกรอบพัฒนาแล้ว" : "สร้างรอบพัฒนาเรียบร้อย")
            setSprintForm(null)
            await fetchProject()
            await fetchBoard()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const deleteSprint = async (sprint: SprintRow) => {
        setBusy(true)
        try {
            const res = await fetch(`/api/projects/${projectId}/sprints/${sprint.id}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                toast.error(await readError(res, "ลบรอบพัฒนาไม่สำเร็จ"))
                return
            }
            const data = (await res.json()) as { movedToBacklog: number }
            toast.success(
                data.movedToBacklog > 0
                    ? `ลบรอบพัฒนาแล้ว — ย้ายงาน ${data.movedToBacklog} รายการกลับ Backlog`
                    : "ลบรอบพัฒนาแล้ว"
            )
            setSprintForm(null)
            if (sprintFilter === sprint.id) setSprintFilter("all")
            await fetchProject()
            await fetchBoard()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    // ── ข้อมูลประกอบหน้าจอ ──

    // ต้องผ่าน useMemo ไม่งั้น array ใหม่ทุก render จะทำให้ useMemo ที่พึ่งพามันคำนวณใหม่ทุกครั้ง
    const sprints = useMemo(() => project?.sprints ?? [], [project])
    const activeSprint = sprints.find((s) => s.status === "active") ?? null
    const selectedSprint = sprints.find((s) => s.id === sprintFilter) ?? null

    /// สรุปของกระดานที่กำลังดูอยู่ (เฉพาะรอบที่เลือก ไม่ใช่ทั้งโครงการ) — F5.12
    const viewSummary = useMemo(() => {
        const counts = Object.fromEntries(BOARD_STATUSES.map((s) => [s, 0])) as Record<
            string,
            number
        >
        let estimateTotal = 0
        let estimateDone = 0
        let loggedTotal = 0
        for (const t of tasks) {
            if (t.boardStatus in counts) counts[t.boardStatus] += 1
            estimateTotal += t.estimateHours ?? 0
            if (t.boardStatus === "done") estimateDone += t.estimateHours ?? 0
            loggedTotal += t.loggedHours
        }
        const done = counts.done ?? 0
        return {
            counts,
            total: tasks.length,
            done,
            progress: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0,
            estimateTotal: Math.round(estimateTotal * 100) / 100,
            estimateDone: Math.round(estimateDone * 100) / 100,
            loggedTotal: Math.round(loggedTotal * 100) / 100,
        }
    }, [tasks])

    const canDragTask = useCallback(
        (task: TaskCard) => canManage || task.assigneeId === currentUserId,
        [canManage, currentUserId]
    )

    /// ปลายทางที่ลากการ์ดไปวางเพื่อย้ายรอบได้ — ตัดรอบที่กำลังดูอยู่ออกเพราะวางแล้วไม่มีอะไรเปลี่ยน
    const sprintTargets = useMemo<SprintDropTarget[]>(() => {
        const all: SprintDropTarget[] = [
            { key: "none", label: "Backlog", sprintId: null },
            ...sprints.map((s) => ({ key: s.id, label: s.name, sprintId: s.id })),
        ]
        return all.filter((t) => t.key !== sprintFilter)
    }, [sprints, sprintFilter])

    if (loading && !project) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-72" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!project) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-16 text-center text-sm">
                    ไม่พบโครงการที่ต้องการ
                    <div className="mt-4">
                        <Button variant="outline" asChild>
                            <Link href="/management/projects">
                                <ArrowLeft className="size-4" />
                                กลับไปรายการโครงการ
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* หัวข้อหน้า */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
                        <Link href="/management/projects">
                            <ArrowLeft className="size-4" />
                            รายการโครงการ
                        </Link>
                    </Button>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-mono text-sm">
                            {project.code}
                        </span>
                        <ProjectStatusBadge status={project.status} />
                    </div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
                    {project.description && (
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                            {project.description}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            void fetchProject()
                            void fetchBoard()
                        }}
                    >
                        <RefreshCw className={boardLoading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    {canManage && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setSprintForm({ ...EMPTY_SPRINT })}
                            >
                                <CalendarRange className="size-4" />
                                สร้างรอบพัฒนา
                            </Button>
                            <Button
                                onClick={() =>
                                    setTaskTarget({
                                        boardStatus: "backlog",
                                        sprintId:
                                            sprintFilter === "all" || sprintFilter === "none"
                                                ? null
                                                : sprintFilter,
                                    })
                                }
                            >
                                <Plus className="size-4" />
                                เพิ่มงาน
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* การ์ดสรุปโครงการ (F5.2) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="space-y-3">
                        <p className="text-muted-foreground text-sm">ความคืบหน้าทั้งโครงการ</p>
                        <p className="text-2xl font-semibold">{project.progress}%</p>
                        <ProgressBar value={project.progress} showLabel={false} />
                    </CardContent>
                </Card>
                <StatCard
                    icon={<ListChecks className="size-5" />}
                    label="งานที่ปิดแล้ว"
                    value={`${project.board.done}/${project.board.total}`}
                    tone="bg-status-resolved-bg text-status-resolved-fg"
                />
                <StatCard
                    icon={<Clock className="size-5" />}
                    label="ชั่วโมง — ลงจริง / ประมาณไว้"
                    value={`${project.board.loggedTotal}/${project.board.estimateTotal} ชม.`}
                    tone="bg-status-progress-bg text-status-progress-fg"
                />
                <Card>
                    <CardContent className="space-y-2">
                        <p className="text-muted-foreground text-sm">เจ้าของโครงการ</p>
                        <PersonChip person={project.owner} size={28} />
                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Users className="size-3.5" />
                            {project.team
                                ? `${project.team.name} · ${project.team._count.members} คน`
                                : "ยังไม่ระบุทีม"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ช่วงเวลาโครงการ + รอบที่กำลังเดิน */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                    ช่วงโครงการ:{" "}
                    {project.startDate || project.endDate
                        ? `${formatThaiDate(project.startDate)} – ${formatThaiDate(project.endDate)}`
                        : "ยังไม่กำหนด"}
                </span>
                {activeSprint && (
                    <span className="flex items-center gap-2">
                        รอบที่กำลังเดิน:
                        <span className="text-foreground font-medium">{activeSprint.name}</span>
                        <SprintStatusBadge status={activeSprint.status} />
                        <span>{thaiDateRange(activeSprint.startDate, activeSprint.endDate)}</span>
                    </span>
                )}
            </div>

            {/* แถบเลือกรอบพัฒนา (F5.3, F5.13) */}
            <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                    active={sprintFilter === "all"}
                    onClick={() => setSprintFilter("all")}
                    label={`ทั้งโครงการ (${project.board.total})`}
                />
                <FilterChip
                    active={sprintFilter === "none"}
                    onClick={() => setSprintFilter("none")}
                    label="Backlog"
                />
                {sprints.map((s) => (
                    <FilterChip
                        key={s.id}
                        active={sprintFilter === s.id}
                        onClick={() => setSprintFilter(s.id)}
                        label={`${s.name} (${s._count.tasks})`}
                    />
                ))}
                {canManage && selectedSprint && (
                    <span className="ml-1 flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setSprintForm({
                                    id: selectedSprint.id,
                                    name: selectedSprint.name,
                                    goal: selectedSprint.goal ?? "",
                                    startDate: toDateInput(selectedSprint.startDate),
                                    endDate: toDateInput(selectedSprint.endDate),
                                    status: selectedSprint.status as SprintStatus,
                                })
                            }
                        >
                            <Pencil className="size-4" />
                            <span className="sr-only">แก้ไขรอบพัฒนา</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void deleteSprint(selectedSprint)}
                            disabled={busy}
                        >
                            <Trash2 className="text-priority-critical size-4" />
                            <span className="sr-only">ลบรอบพัฒนา</span>
                        </Button>
                    </span>
                )}
            </div>

            {/* สรุปของกระดานที่กำลังดู (F5.12) */}
            <Card>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium">
                                {sprintFilter === "all"
                                    ? "สรุปทั้งโครงการ"
                                    : sprintFilter === "none"
                                      ? "สรุป Backlog"
                                      : `สรุป ${selectedSprint?.name ?? "รอบพัฒนา"}`}
                            </p>
                            {boardSprint && (
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {thaiDateRange(boardSprint.startDate, boardSprint.endDate)}
                                    {boardSprint.goal ? ` · ${boardSprint.goal}` : ""}
                                </p>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm">
                            ปิดแล้ว {viewSummary.done}/{viewSummary.total} งาน · ประมาณไว้{" "}
                            {viewSummary.estimateDone}/{viewSummary.estimateTotal} ชม. · ลงเวลาจริง{" "}
                            {viewSummary.loggedTotal} ชม.
                        </p>
                    </div>

                    <ProgressBar value={viewSummary.progress} showLabel={false} />

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {BOARD_STATUSES.map((s) => (
                            <div key={s} className="bg-muted/40 rounded-lg px-3 py-2">
                                <p className="text-muted-foreground text-xs">
                                    {BOARD_STATUS_LABEL[s]}
                                </p>
                                <p className="text-lg font-semibold">{viewSummary.counts[s] ?? 0}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* กระดาน (F5.4, F5.5) */}
            {boardLoading ? (
                <Skeleton className="h-[420px] w-full" />
            ) : (
                <KanbanBoard
                    tasks={tasks}
                    onMove={(payload) => void handleMove(payload)}
                    onOpen={(task) => setTaskTarget({ id: task.id })}
                    canDrag={canDragTask}
                    sprintTargets={canManage ? sprintTargets : []}
                    onMoveToSprint={(task, target) => void handleMoveToSprint(task, target)}
                />
            )}

            {/* กล่องรายละเอียดงาน */}
            <TaskDialog
                projectId={projectId}
                target={taskTarget}
                onClose={closeTaskDialog}
                onSaved={() => {
                    void fetchProject()
                    void fetchBoard()
                }}
                sprints={sprints}
                agents={agents}
                canManage={canManage}
                currentUserId={currentUserId}
            />

            {/* ฟอร์มรอบพัฒนา */}
            <Dialog open={sprintForm !== null} onOpenChange={(v) => !v && setSprintForm(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {sprintForm?.id ? "แก้ไขรอบพัฒนา" : "สร้างรอบพัฒนาใหม่"}
                        </DialogTitle>
                        <DialogDescription>
                            หนึ่งโครงการมีรอบที่ &ldquo;กำลังดำเนินการ&rdquo; ได้ทีละรอบเดียว
                            ต้องปิดรอบเดิมก่อนจึงเปิดรอบใหม่ได้
                        </DialogDescription>
                    </DialogHeader>

                    {sprintForm && (
                        <div className="space-y-4">
                            <div>
                                <Label className="mb-1.5">ชื่อรอบ</Label>
                                <Input
                                    value={sprintForm.name}
                                    onChange={(e) =>
                                        setSprintForm({ ...sprintForm, name: e.target.value })
                                    }
                                    placeholder="เช่น Sprint 1 — ระบบรับแจ้งปัญหา"
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">เป้าหมายของรอบ (ไม่บังคับ)</Label>
                                <Textarea
                                    value={sprintForm.goal}
                                    onChange={(e) =>
                                        setSprintForm({ ...sprintForm, goal: e.target.value })
                                    }
                                    rows={2}
                                    placeholder="สิ่งที่ต้องส่งมอบเมื่อจบรอบนี้..."
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label className="mb-1.5">วันเริ่ม</Label>
                                    <Input
                                        type="date"
                                        value={sprintForm.startDate}
                                        onChange={(e) =>
                                            setSprintForm({
                                                ...sprintForm,
                                                startDate: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1.5">วันสิ้นสุด</Label>
                                    <Input
                                        type="date"
                                        value={sprintForm.endDate}
                                        onChange={(e) =>
                                            setSprintForm({ ...sprintForm, endDate: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="mb-1.5">สถานะ</Label>
                                <select
                                    value={sprintForm.status}
                                    onChange={(e) =>
                                        setSprintForm({
                                            ...sprintForm,
                                            status: e.target.value as SprintStatus,
                                        })
                                    }
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    {SPRINT_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {SPRINT_STATUS_LABEL[s]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSprintForm(null)}>
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={() => void saveSprint()}
                            disabled={
                                busy ||
                                !sprintForm ||
                                sprintForm.name.trim().length < 2 ||
                                !sprintForm.startDate ||
                                !sprintForm.endDate
                            }
                        >
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            บันทึก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

function StatCard({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode
    label: string
    value: string
    tone: string
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4">
                <div className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-muted-foreground truncate text-sm">{label}</p>
                    <p className="text-xl font-semibold">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function FilterChip({
    active,
    onClick,
    label,
}: {
    active: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            onClick={onClick}
            className={
                active
                    ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                    : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
            }
        >
            {label}
        </button>
    )
}
