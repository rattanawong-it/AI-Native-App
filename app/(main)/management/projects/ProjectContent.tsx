"use client"

// หน้ารายการโครงการพัฒนา — ค้นหา / กรองสถานะ / สร้าง / แก้ไข / ลบ
// อ้างอิง F5.1 (CRUD Project) และ F5.10 (ความคืบหน้าคำนวณจากสัดส่วน Task ที่ปิดแล้ว)
//
// [M6] เดิมไฟล์นี้เป็น mock `SAMPLE_PROJECTS` — เขียนใหม่ให้เรียก API จริงในเฟส 5
// โครงสร้างหน้า (การ์ดสรุปด้านบน → แถบค้นหา/ตัวกรอง → กริดการ์ดโครงการ) ยังคงของเดิมไว้
// เปลี่ยนเฉพาะแหล่งข้อมูลและใช้ component กลางของโปรเจกต์แทน markup ดิบ

import { rolesAreManager } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    Plus,
    Search,
    RefreshCw,
    Folder,
    Loader2,
    Pencil,
    Trash2,
    Users,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    ListChecks,
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PersonChip } from "@/components/ticket/ticket-badges"
import { ProgressBar, ProjectStatusBadge } from "@/components/project/project-badges"
import {
    PROJECT_STATUSES,
    PROJECT_STATUS_LABEL,
    type ProjectStatus,
} from "@/lib/task-board"
import { formatThaiDate, readError } from "@/lib/ticket-types"
import { toDateInput, type ProjectListResponse, type ProjectRow } from "@/lib/project-types"

const PAGE_SIZE = 24

/// ตัวกรองสถานะแบบปุ่มเดียว — "กำลังติดตาม" คือค่าเริ่มต้นเพราะโครงการที่จบแล้วมีแต่จะสะสม
const STATUS_TABS: { key: string; label: string }[] = [
    { key: "open", label: "กำลังติดตาม" },
    ...PROJECT_STATUSES.map((s) => ({ key: s, label: PROJECT_STATUS_LABEL[s] })),
    { key: "all", label: "ทั้งหมด" },
]

interface FormState {
    id?: string
    code: string
    name: string
    description: string
    status: ProjectStatus
    teamId: string
    startDate: string
    endDate: string
}

const EMPTY_FORM: FormState = {
    code: "",
    name: "",
    description: "",
    status: "planning",
    teamId: "",
    startDate: "",
    endDate: "",
}

interface TeamOption {
    id: string
    name: string
}

export default function ProjectContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canManage = rolesAreManager(roles)

    const [projects, setProjects] = useState<ProjectRow[]>([])
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
    const [teams, setTeams] = useState<TeamOption[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [status, setStatus] = useState("open")
    const [page, setPage] = useState(1)

    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [busy, setBusy] = useState(false)
    const [deleting, setDeleting] = useState<ProjectRow | null>(null)

    // หน่วงการค้นหาไว้ 350ms กันยิง API ทุกตัวอักษร (แบบเดียวกับหน้ารายการ Ticket)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [search])

    const queryString = useMemo(() => {
        const params = new URLSearchParams()
        if (debouncedSearch) params.set("q", debouncedSearch)
        params.set("status", status)
        params.set("page", String(page))
        params.set("pageSize", String(PAGE_SIZE))
        return params.toString()
    }, [debouncedSearch, status, page])

    const fetchProjects = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/projects?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายการโครงการได้"))
                return
            }
            const data = (await res.json()) as ProjectListResponse
            setProjects(data.projects)
            setStatusCounts(data.statusCounts)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [queryString])

    useEffect(() => {
        void fetchProjects()
    }, [fetchProjects])

    useEffect(() => {
        void (async () => {
            const res = await fetch("/api/directory?scope=teams")
            if (res.ok) {
                const data = (await res.json()) as { teams: TeamOption[] }
                setTeams(data.teams)
            }
        })()
    }, [])

    // ── สรุปตัวเลขด้านบน (นับจากทั้งระบบ ไม่ใช่เฉพาะหน้าที่แสดง) ──
    const stats = useMemo(() => {
        const all = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)
        const avgProgress =
            projects.length > 0
                ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
                : 0
        return {
            all,
            active: statusCounts.active ?? 0,
            completed: statusCounts.completed ?? 0,
            avgProgress,
        }
    }, [statusCounts, projects])

    const openCreate = () => {
        setForm(EMPTY_FORM)
        setFormOpen(true)
    }

    const openEdit = (p: ProjectRow) => {
        setForm({
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description ?? "",
            status: p.status as ProjectStatus,
            teamId: p.teamId ?? "",
            startDate: toDateInput(p.startDate),
            endDate: toDateInput(p.endDate),
        })
        setFormOpen(true)
    }

    const save = async () => {
        setBusy(true)
        try {
            // ส่งเฉพาะฟิลด์ที่กรอก — ช่องว่างหมายถึง "ไม่ระบุ" จึงต้องเป็น null ไม่ใช่สตริงว่าง
            const payload = {
                code: form.code,
                name: form.name,
                description: form.description.trim() || null,
                status: form.status,
                teamId: form.teamId || null,
                startDate: form.startDate || null,
                endDate: form.endDate || null,
            }
            const res = await fetch(form.id ? `/api/projects/${form.id}` : "/api/projects", {
                method: form.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกโครงการไม่สำเร็จ"))
                return
            }
            toast.success(form.id ? "บันทึกการแก้ไขแล้ว" : "สร้างโครงการเรียบร้อย")
            setFormOpen(false)
            await fetchProjects()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        if (!deleting) return
        setBusy(true)
        try {
            const res = await fetch(`/api/projects/${deleting.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบโครงการไม่สำเร็จ"))
                return
            }
            toast.success("ลบโครงการแล้ว")
            setDeleting(null)
            await fetchProjects()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* หัวข้อหน้า */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">โครงการพัฒนา</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        จัดการโครงการพัฒนาซอฟต์แวร์ รอบพัฒนา และกระดานงานของทีม
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/management/teams">
                            <Users className="size-4" />
                            ทีมงาน
                        </Link>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => void fetchProjects()}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    {canManage && (
                        <Button onClick={openCreate}>
                            <Plus className="size-4" />
                            สร้างโครงการ
                        </Button>
                    )}
                </div>
            </div>

            {/* การ์ดสรุป */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<Folder className="size-5" />}
                    label="โครงการทั้งหมด"
                    value={stats.all}
                    tone="bg-brand-tint text-brand"
                />
                <StatCard
                    icon={<ListChecks className="size-5" />}
                    label="กำลังดำเนินการ"
                    value={stats.active}
                    tone="bg-status-progress-bg text-status-progress-fg"
                />
                <StatCard
                    icon={<CheckCircle2 className="size-5" />}
                    label="เสร็จสิ้นแล้ว"
                    value={stats.completed}
                    tone="bg-status-resolved-bg text-status-resolved-fg"
                />
                <StatCard
                    icon={<CalendarDays className="size-5" />}
                    label="ความคืบหน้าเฉลี่ย (หน้านี้)"
                    value={`${stats.avgProgress}%`}
                    tone="bg-status-new-bg text-status-new-fg"
                />
            </div>

            {/* ค้นหา + ตัวกรอง */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ค้นหารหัสโครงการ ชื่อ หรือรายละเอียด..."
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    {STATUS_TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => {
                                setStatus(t.key)
                                setPage(1)
                            }}
                            className={
                                status === t.key
                                    ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                                    : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* กริดการ์ดโครงการ */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-56 w-full" />
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <Card>
                    <CardContent className="text-muted-foreground py-16 text-center text-sm">
                        <Folder className="mx-auto mb-3 size-8 opacity-40" />
                        ไม่พบโครงการตามเงื่อนไขที่เลือก
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((p) => (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            canManage={canManage}
                            onEdit={() => openEdit(p)}
                            onDelete={() => setDeleting(p)}
                        />
                    ))}
                </div>
            )}

            {/* pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                    {total === 0
                        ? "ไม่มีรายการ"
                        : `แสดง ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} จาก ${total} โครงการ`}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        <ChevronLeft className="size-4" />
                        <span className="sr-only">หน้าก่อนหน้า</span>
                    </Button>
                    <span className="text-sm">
                        หน้า {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                        <ChevronRight className="size-4" />
                        <span className="sr-only">หน้าถัดไป</span>
                    </Button>
                </div>
            </div>

            {/* ฟอร์มสร้าง/แก้ไข */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{form.id ? "แก้ไขโครงการ" : "สร้างโครงการใหม่"}</DialogTitle>
                        <DialogDescription>
                            รหัสโครงการใช้อ้างถึงในเลขงานและรายงาน จึงตั้งให้สั้นและจำง่าย
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                            <div>
                                <Label className="mb-1.5">รหัสโครงการ</Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) =>
                                        setForm({ ...form, code: e.target.value.toUpperCase() })
                                    }
                                    placeholder="ITSM"
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">ชื่อโครงการ</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="เช่น ระบบบริหารงานบริการศูนย์ไอที"
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="mb-1.5">รายละเอียด (ไม่บังคับ)</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="เป้าหมายและขอบเขตของโครงการ..."
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">สถานะ</Label>
                                <select
                                    value={form.status}
                                    onChange={(e) =>
                                        setForm({ ...form, status: e.target.value as ProjectStatus })
                                    }
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    {PROJECT_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {PROJECT_STATUS_LABEL[s]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="mb-1.5">ทีมที่รับผิดชอบ</Label>
                                <select
                                    value={form.teamId}
                                    onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    <option value="">ยังไม่ระบุทีม</option>
                                    {teams.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">วันเริ่ม (ไม่บังคับ)</Label>
                                <Input
                                    type="date"
                                    value={form.startDate}
                                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">กำหนดเสร็จ (ไม่บังคับ)</Label>
                                <Input
                                    type="date"
                                    value={form.endDate}
                                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={() => void save()}
                            disabled={
                                busy || form.code.trim().length < 2 || form.name.trim().length < 3
                            }
                        >
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            บันทึก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ยืนยันการลบ */}
            <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบโครงการนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{deleting?.name}&rdquo; จะถูกลบพร้อมรอบพัฒนาและงานทั้งหมดในโครงการ
                            หากมีงานที่มีบันทึกเวลาทำงานผูกอยู่ ระบบจะไม่ยอมให้ลบ
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove()} disabled={busy}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            ลบโครงการ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
    value: number | string
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
                    <p className="text-2xl font-semibold">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function ProjectCard({
    project,
    canManage,
    onEdit,
    onDelete,
}: {
    project: ProjectRow
    canManage: boolean
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <Card className="group flex h-full flex-col transition-shadow hover:shadow-md">
            <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground font-mono text-xs">
                                {project.code}
                            </span>
                            <ProjectStatusBadge status={project.status} />
                        </div>
                        <Link
                            href={`/management/projects/${project.id}`}
                            className="hover:text-brand block truncate text-base font-semibold transition-colors"
                        >
                            {project.name}
                        </Link>
                    </div>
                    {canManage && (
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button variant="ghost" size="icon" onClick={onEdit}>
                                <Pencil className="size-4" />
                                <span className="sr-only">แก้ไข</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onDelete}>
                                <Trash2 className="text-priority-critical size-4" />
                                <span className="sr-only">ลบ</span>
                            </Button>
                        </div>
                    )}
                </div>

                <p className="text-muted-foreground line-clamp-2 min-h-[2.5rem] text-sm">
                    {project.description || "ยังไม่มีคำอธิบายโครงการ"}
                </p>

                <ProgressBar value={project.progress} />

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                        <ListChecks className="size-4" />
                        {project.doneTasks}/{project._count.tasks} งาน
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        {project._count.sprints} รอบพัฒนา
                    </span>
                    {project.team && (
                        <span className="inline-flex items-center gap-1.5">
                            <Users className="size-4" />
                            {project.team.name}
                        </span>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                    <PersonChip person={project.owner} size={24} />
                    <span className="text-muted-foreground shrink-0 text-xs">
                        {project.endDate ? `กำหนด ${formatThaiDate(project.endDate)}` : "ไม่กำหนดวันจบ"}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
