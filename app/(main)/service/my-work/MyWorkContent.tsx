"use client"

// หน้า "งานของฉัน" — รวม Ticket ที่ได้รับมอบหมาย, Task โครงการ, งานส่วนตัว และบันทึกเวลา
// อ้างอิง F3.1 (3 แท็บ), F3.2 (มุมมองรวมเรียงตามกำหนดส่ง), F3.7 (สรุปเวลาทำงานของตัวเอง)
// admin เลือกดู My Work ของเจ้าหน้าที่คนอื่นได้แบบอ่านอย่างเดียว (spec §20)

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    RefreshCw,
    ChevronRight,
    ListTodo,
    AlertTriangle,
    CalendarDays,
    Timer,
    Ticket as TicketIcon,
    KanbanSquare,
    Search,
    Eye,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { rolesAreAdmin } from "@/lib/roles"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PriorityBadge } from "@/components/ticket/ticket-badges"
import { readError, formatThaiDate, formatThaiDateTime } from "@/lib/ticket-types"
import {
    WORK_KIND_LABEL,
    formatMinutes,
    type MyWorkResponse,
    type WorkItem,
    type WorkLogSummary,
} from "@/lib/worklog-types"
import TodoPanel from "@/app/(main)/service/my-work/TodoPanel"
import TimeLogPanel from "@/app/(main)/service/my-work/TimeLogPanel"

/// แท็บหลักของหน้า — 3 แท็บแรกตาม F3.1 บวกมุมมองรวม (F3.2) และบันทึกเวลา (F3.5)
const TABS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "ticket", label: "Ticket ของฉัน" },
    { key: "task", label: "Task โครงการ" },
    { key: "todo", label: "งานส่วนตัว" },
    { key: "timelog", label: "บันทึกเวลา" },
] as const

type TabKey = (typeof TABS)[number]["key"]

/// ตัวกรองสถานะของงาน — ใช้ร่วมกันทุกแท็บที่แสดงรายการงาน
const STATE_FILTERS = [
    { key: "open", label: "ค้างอยู่" },
    { key: "overdue", label: "เลยกำหนด" },
    { key: "today", label: "ครบกำหนดวันนี้" },
    { key: "done", label: "เสร็จแล้ว" },
] as const

const KIND_ICON: Record<WorkItem["kind"], React.ReactNode> = {
    ticket: <TicketIcon className="size-4" />,
    task: <KanbanSquare className="size-4" />,
    todo: <ListTodo className="size-4" />,
}

/// เจ้าหน้าที่ในตัวเลือก "ดูงานของ" — มาจาก /api/directory?scope=agents
interface StaffOption {
    id: string
    name: string
    email: string
}

export default function MyWorkContent({ initialUserId }: { initialUserId?: string }) {
    const router = useRouter()
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isAdmin = rolesAreAdmin(roles)
    const sessionUserId = session?.user?.id

    const [tab, setTab] = useState<TabKey>("all")
    const [state, setState] = useState<string>("open")
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    /// "" = งานของตัวเอง · id = งานของคนที่ admin เลือกดู
    const [viewUserId, setViewUserId] = useState(initialUserId ?? "")
    const [staff, setStaff] = useState<StaffOption[]>([])

    const [data, setData] = useState<MyWorkResponse | null>(null)
    const [summary, setSummary] = useState<WorkLogSummary | null>(null)
    const [loading, setLoading] = useState(true)

    /// ดูของคนอื่นอยู่ไหม — เลือกตัวเองจากลิงก์ก็ถือว่าเป็นของตัวเอง
    const viewingOther = viewUserId !== "" && viewUserId !== sessionUserId
    const targetUserId = viewingOther ? viewUserId : undefined
    const viewedName = staff.find((s) => s.id === viewUserId)?.name ?? "ผู้ใช้ที่เลือก"

    // หน่วงการค้นหาไว้ 350ms กันยิง API ทุกตัวอักษร — แบบเดียวกับหน้ารายการ Ticket
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 350)
        return () => clearTimeout(timer)
    }, [search])

    // รายชื่อเจ้าหน้าที่สำหรับ admin เท่านั้น — คนอื่นไม่เห็นตัวเลือกนี้
    useEffect(() => {
        if (!isAdmin) return
        void (async () => {
            try {
                const res = await fetch("/api/directory?scope=agents")
                if (res.ok) setStaff(((await res.json()) as { agents: StaffOption[] }).agents)
            } catch {
                // ไม่มีรายชื่อก็ยังดูงานของตัวเองได้ตามปกติ
            }
        })()
    }, [isAdmin])

    const changeViewUser = (id: string) => {
        setViewUserId(id)
        // เก็บคนที่เลือกไว้ใน URL ให้รีเฟรช/แชร์ลิงก์แล้วยังดูคนเดิม
        router.replace(
            id ? `/service/my-work?userId=${encodeURIComponent(id)}` : "/service/my-work",
            { scroll: false }
        )
    }

    /// แท็บที่แสดงรายการงานรวม (ไม่รวมงานส่วนตัวกับบันทึกเวลาที่มีหน้าจอของตัวเอง)
    const isListTab = tab === "all" || tab === "ticket" || tab === "task"

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                kind: isListTab ? tab : "all",
                state,
            })
            if (debouncedSearch) params.set("q", debouncedSearch)
            if (targetUserId) params.set("userId", targetUserId)

            const res = await fetch(`/api/my-work?${params.toString()}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดงานของฉันได้"))
                return
            }
            setData((await res.json()) as MyWorkResponse)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [tab, isListTab, state, debouncedSearch, targetUserId])

    useEffect(() => {
        void load()
    }, [load])

    /// F3.7 — เวลาทำงานสัปดาห์นี้ของเจ้าของ My Work ที่กำลังดู แสดงบนการ์ดสรุปตลอดเวลา
    const loadSummary = useCallback(async () => {
        try {
            const params = new URLSearchParams({ period: "week", scope: "own" })
            if (targetUserId) params.set("userId", targetUserId)
            const res = await fetch(`/api/worklogs/summary?${params.toString()}`)
            if (res.ok) setSummary((await res.json()) as WorkLogSummary)
        } catch {
            // การ์ดสรุปไม่ใช่ข้อมูลหลักของหน้า — พลาดแล้วปล่อยว่างไว้ ไม่ต้องรบกวนผู้ใช้
        }
    }, [targetUserId])

    useEffect(() => {
        void loadSummary()
    }, [loadSummary])

    const counts = data?.counts
    const items = data?.items ?? []

    const emptyText = useMemo(() => {
        if (debouncedSearch) return "ไม่พบงานที่ตรงกับคำค้นหา"
        if (state === "overdue") return "ไม่มีงานที่เลยกำหนด"
        if (state === "today") return "ไม่มีงานที่ครบกำหนดวันนี้"
        if (state === "done") return "ยังไม่มีงานที่ทำเสร็จ"
        return "ไม่มีงานค้างอยู่"
    }, [debouncedSearch, state])

    return (
        <div className="space-y-6">
            {/* หัวข้อหน้า */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {viewingOther ? `งานของ ${viewedName}` : "งานของฉัน"}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Ticket ที่ได้รับมอบหมาย งานโครงการ งานส่วนตัว และบันทึกเวลาทำงานในที่เดียว
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <select
                            value={viewingOther ? viewUserId : ""}
                            onChange={(e) => changeViewUser(e.target.value)}
                            className="border-input bg-background h-9 min-w-[200px] rounded-md border px-3 text-sm"
                            aria-label="ดูงานของ"
                        >
                            <option value="">ดูงานของ: ตัวฉันเอง</option>
                            {staff
                                .filter((s) => s.id !== sessionUserId)
                                .map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                        </select>
                    )}
                    <Button variant="outline" size="icon" onClick={() => void load()}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                </div>
            </div>

            {viewingOther && (
                <div className="bg-status-assigned-bg text-status-assigned-fg flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm">
                    <span className="flex items-center gap-2">
                        <Eye className="size-4" />
                        กำลังตรวจสอบงานของ {viewedName} — โหมดอ่านอย่างเดียว แก้ไขหรือลบไม่ได้
                    </span>
                    <Button variant="outline" size="sm" onClick={() => changeViewUser("")}>
                        กลับไปงานของฉัน
                    </Button>
                </div>
            )}

            {/* การ์ดสรุป */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<ListTodo className="size-5" />}
                    label="งานค้างทั้งหมด"
                    value={counts ? String(counts.all) : "-"}
                    tone="bg-brand-tint text-brand"
                />
                <StatCard
                    icon={<AlertTriangle className="size-5" />}
                    label="เลยกำหนด"
                    value={counts ? String(counts.overdue) : "-"}
                    tone="bg-priority-critical-bg text-priority-critical-fg"
                />
                <StatCard
                    icon={<CalendarDays className="size-5" />}
                    label="ครบกำหนดวันนี้"
                    value={counts ? String(counts.today) : "-"}
                    tone="bg-status-progress-bg text-status-progress-fg"
                />
                <StatCard
                    icon={<Timer className="size-5" />}
                    label="เวลาทำงานสัปดาห์นี้"
                    value={summary ? formatMinutes(summary.totalMinutes) : "-"}
                    tone="bg-status-resolved-bg text-status-resolved-fg"
                />
            </div>

            {/* แท็บ */}
            <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={
                            tab === t.key
                                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                                : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                        }
                    >
                        {viewingOther && t.key === "ticket" ? "Ticket" : t.label}
                        {counts && t.key !== "timelog" && (
                            <span className="ml-1.5 opacity-70">
                                {t.key === "all" ? counts.all : counts[t.key]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {tab === "todo" ? (
                <TodoPanel
                    key={viewUserId}
                    userId={targetUserId}
                    readOnly={viewingOther}
                    onChanged={() => {
                        void load()
                    }}
                />
            ) : tab === "timelog" ? (
                <TimeLogPanel
                    key={viewUserId}
                    userId={targetUserId}
                    readOnly={viewingOther}
                    onChanged={() => {
                        void loadSummary()
                    }}
                />
            ) : (
                <>
                    {/* ค้นหา + กรองสถานะ */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[240px] flex-1">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="ค้นหาจากหัวข้องาน..."
                                className="pl-9"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {STATE_FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => setState(f.key)}
                                    className={
                                        state === f.key
                                            ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                                            : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                                    }
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* รายการงาน */}
                    <Card className="overflow-hidden py-0">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="space-y-3 p-6">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : items.length === 0 ? (
                                <div className="text-muted-foreground p-12 text-center text-sm">
                                    <ListTodo className="mx-auto mb-3 size-8 opacity-40" />
                                    {emptyText}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[760px]">
                                        {items.map((item, i) => (
                                            <WorkRow
                                                key={`${item.kind}-${item.id}`}
                                                item={item}
                                                divided={i > 0}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {data?.truncated && (
                        <p className="text-muted-foreground text-sm">
                            แสดงเฉพาะงานที่เร่งที่สุด 100 รายการแรก — ใช้ตัวกรองเพื่อดูให้แคบลง
                        </p>
                    )}
                </>
            )}
        </div>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

/// แถวงานหนึ่งชิ้น — กดได้เมื่อมีหน้าปลายทาง (Task ยังไม่มีจนถึงเฟส 5)
function WorkRow({ item, divided }: { item: WorkItem; divided: boolean }) {
    const overdue = !item.isDone && item.dueDate && new Date(item.dueDate) < new Date()

    const inner = (
        <>
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
                {KIND_ICON[item.kind]}
                <span className="hidden sm:inline">{WORK_KIND_LABEL[item.kind]}</span>
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground block truncate text-xs">
                    {[item.code, item.context].filter(Boolean).join(" · ") || "-"}
                </span>
            </span>
            <PriorityBadge priority={item.priority} />
            <span className="text-muted-foreground truncate text-sm">{item.status}</span>
            {/* เวลาที่ใช้ไปกับงานนี้ รวมจาก Time Log ของเจ้าของงาน (spec §20) */}
            <span
                className="text-muted-foreground flex items-center gap-1 text-sm"
                title="เวลาที่บันทึกไว้กับงานนี้"
            >
                <Timer className="size-3.5 shrink-0" />
                {item.loggedMinutes > 0 ? formatMinutes(item.loggedMinutes) : "-"}
            </span>
            <span
                className={
                    overdue ? "text-sla-breached text-sm font-medium" : "text-muted-foreground text-sm"
                }
                title={item.dueDate ? formatThaiDateTime(item.dueDate) : undefined}
            >
                {item.dueDate ? formatThaiDate(item.dueDate) : "ไม่กำหนด"}
            </span>
            {item.href ? (
                <ChevronRight className="text-muted-foreground size-4" />
            ) : (
                <span className="size-4" />
            )}
        </>
    )

    const layout =
        "grid grid-cols-[110px_minmax(0,2.4fr)_110px_minmax(0,1fr)_100px_130px_32px] items-center gap-3 px-6 py-3.5" +
        (divided ? " border-t" : "")

    if (!item.href) {
        return <div className={layout}>{inner}</div>
    }

    return (
        <Link href={item.href} className={`hover:bg-accent/50 transition-colors ${layout}`}>
            {inner}
        </Link>
    )
}

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
                    <p className="text-2xl font-semibold">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}
