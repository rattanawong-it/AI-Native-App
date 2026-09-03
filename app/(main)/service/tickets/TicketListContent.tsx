"use client"

// หน้ารายการ Ticket — ฟิลเตอร์ / ค้นหา / pagination / ส่งออก Excel
// อ้างอิง F1.3, F1.4, F1.11, F1.12, F2.3, F2.5, F4.8

import { rolesAreStaff } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    Search,
    Plus,
    RefreshCw,
    Download,
    ChevronRight,
    ChevronLeft,
    Ticket as TicketIcon,
    AlertTriangle,
    Clock,
    CheckCircle2,
    ListFilter,
    Users,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    PriorityBadge,
    StatusBadge,
    SlaIndicator,
    PersonChip,
} from "@/components/ticket/ticket-badges"
import { PRIORITY_LEVELS, PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { TICKET_STATUSES, TICKET_STATUS_LABEL } from "@/lib/ticket-workflow"
import {
    readError,
    type Category,
    type TicketListResponse,
    type TicketRow,
} from "@/lib/ticket-types"

const PAGE_SIZE = 20

/// ตัวกรองสถานะแบบปุ่มเดียว — ตรงกับไฟล์ดีไซน์
const STATUS_TABS: { key: string; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    ...TICKET_STATUSES.map((s) => ({ key: s, label: TICKET_STATUS_LABEL[s] })),
]

export default function TicketListContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isStaff = rolesAreStaff(roles)

    const [tickets, setTickets] = useState<TicketRow[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)

    // ── ฟิลเตอร์ ──
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [status, setStatus] = useState("all")
    const [priority, setPriority] = useState("all")
    const [categoryId, setCategoryId] = useState("all")
    const [assigneeId, setAssigneeId] = useState("all")
    const [from, setFrom] = useState("")
    const [to, setTo] = useState("")
    const [sort, setSort] = useState("queue")
    const [page, setPage] = useState(1)

    // หน่วงการค้นหาไว้ 350ms กันยิง API ทุกตัวอักษร (F1.11)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [search])

    /// เปลี่ยนฟิลเตอร์ตัวไหนก็ต้องกลับไปหน้าแรกเสมอ ไม่งั้นจะยิง API สองรอบ
    const filterSetter =
        (setter: (v: string) => void) =>
        (value: string) => {
            setter(value)
            setPage(1)
        }

    /// ประกอบ query string ให้ตรงกับ listTicketsQuerySchema
    const queryString = useMemo(() => {
        const params = new URLSearchParams()
        if (debouncedSearch) params.set("q", debouncedSearch)
        if (status !== "all") params.set("status", status)
        if (priority !== "all") params.set("priority", priority)
        if (categoryId !== "all") params.set("categoryId", categoryId)
        if (assigneeId !== "all") params.set("assigneeId", assigneeId)
        if (from) params.set("from", from)
        if (to) params.set("to", to)
        params.set("sort", sort)
        params.set("page", String(page))
        params.set("pageSize", String(PAGE_SIZE))
        return params.toString()
    }, [debouncedSearch, status, priority, categoryId, assigneeId, from, to, sort, page])

    const fetchTickets = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/tickets?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายการ Ticket ได้"))
                return
            }
            const data = (await res.json()) as TicketListResponse
            setTickets(data.tickets)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [queryString])

    useEffect(() => {
        void fetchTickets()
    }, [fetchTickets])

    useEffect(() => {
        void (async () => {
            const res = await fetch("/api/categories")
            if (res.ok) {
                const data = (await res.json()) as { categories: Category[] }
                setCategories(data.categories)
            }
        })()
    }, [])

    /// F1.12 — ส่งออก Excel ด้วยฟิลเตอร์ชุดเดียวกับที่เห็นอยู่
    const handleExport = async () => {
        setExporting(true)
        try {
            const res = await fetch(`/api/tickets/export?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถส่งออกรายงานได้"))
                return
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `tickets-${new Date().toISOString().slice(0, 10)}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
            toast.success("ส่งออกไฟล์ Excel เรียบร้อย")
        } catch {
            toast.error("ส่งออกรายงานไม่สำเร็จ")
        } finally {
            setExporting(false)
        }
    }

    // ── สรุปตัวเลขด้านบน (นับจากหน้าที่กำลังแสดง) ──
    const stats = useMemo(() => {
        const open = tickets.filter((t) => t.status === "new").length
        const doing = tickets.filter((t) => t.status === "in_progress").length
        const breached = tickets.filter((t) => t.sla?.status === "breached").length
        return { open, doing, breached }
    }, [tickets])

    const activeFilters =
        (debouncedSearch ? 1 : 0) +
        (status !== "all" ? 1 : 0) +
        (priority !== "all" ? 1 : 0) +
        (categoryId !== "all" ? 1 : 0) +
        (assigneeId !== "all" ? 1 : 0) +
        (from ? 1 : 0) +
        (to ? 1 : 0)

    const resetFilters = () => {
        setSearch("")
        setStatus("all")
        setPriority("all")
        setCategoryId("all")
        setAssigneeId("all")
        setFrom("")
        setTo("")
        setPage(1)
    }

    return (
        <div className="space-y-6">
            {/* หัวข้อหน้า */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Ticket ทั้งหมด</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {isStaff
                            ? "จัดการและติดตาม Helpdesk Ticket ทั้งหมดในระบบ"
                            : "รายการแจ้งปัญหาและคำขอบริการของคุณ"}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isStaff && (
                        <>
                            <Button variant="outline" asChild>
                                <Link href="/service/tickets/queue">
                                    <Users className="size-4" />
                                    คิวงานทีม
                                </Link>
                            </Button>
                            <Button variant="outline" onClick={handleExport} disabled={exporting}>
                                <Download className="size-4" />
                                {exporting ? "กำลังส่งออก..." : "ส่งออก Excel"}
                            </Button>
                        </>
                    )}
                    <Button variant="outline" size="icon" onClick={() => void fetchTickets()}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    <Button asChild>
                        <Link href="/service/tickets/new">
                            <Plus className="size-4" />
                            แจ้งปัญหาใหม่
                        </Link>
                    </Button>
                </div>
            </div>

            {/* การ์ดสรุป */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<TicketIcon className="size-5" />}
                    label="ทั้งหมด"
                    value={total}
                    tone="bg-brand-tint text-brand"
                />
                <StatCard
                    icon={<AlertTriangle className="size-5" />}
                    label="รอรับเรื่อง (หน้านี้)"
                    value={stats.open}
                    tone="bg-status-new-bg text-status-new-fg"
                />
                <StatCard
                    icon={<Clock className="size-5" />}
                    label="กำลังดำเนินการ (หน้านี้)"
                    value={stats.doing}
                    tone="bg-status-progress-bg text-status-progress-fg"
                />
                <StatCard
                    icon={<CheckCircle2 className="size-5" />}
                    label="เกิน SLA (หน้านี้)"
                    value={stats.breached}
                    tone="bg-priority-critical-bg text-priority-critical-fg"
                />
            </div>

            {/* แถบค้นหา + ฟิลเตอร์ */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[240px] flex-1">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="ค้นหาเลขที่ Ticket, หัวข้อ หรือรายละเอียด..."
                            className="pl-9"
                        />
                    </div>
                    <select
                        value={sort}
                        onChange={(e) => filterSetter(setSort)(e.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                        <option value="queue">เรียงตามคิวงาน</option>
                        <option value="newest">ใหม่สุดก่อน</option>
                        <option value="oldest">เก่าสุดก่อน</option>
                        <option value="due">ใกล้ครบกำหนดก่อน</option>
                    </select>
                    {activeFilters > 0 && (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                            <ListFilter className="size-4" />
                            ล้างตัวกรอง ({activeFilters})
                        </Button>
                    )}
                </div>

                {/* ปุ่มกรองสถานะ */}
                <div className="flex flex-wrap gap-2">
                    {STATUS_TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => filterSetter(setStatus)(t.key)}
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

                {/* ฟิลเตอร์ละเอียด */}
                <div className="flex flex-wrap gap-3">
                    <FilterSelect
                        label="ความสำคัญ"
                        value={priority}
                        onChange={filterSetter(setPriority)}
                        options={[
                            { value: "all", label: "ทุกระดับ" },
                            ...PRIORITY_LEVELS.map((p) => ({
                                value: p,
                                label: PRIORITY_LABEL[p as Priority],
                            })),
                        ]}
                    />
                    <FilterSelect
                        label="หมวดหมู่"
                        value={categoryId}
                        onChange={filterSetter(setCategoryId)}
                        options={[
                            { value: "all", label: "ทุกหมวดหมู่" },
                            ...categories.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                    />
                    {isStaff && (
                        <FilterSelect
                            label="ผู้รับผิดชอบ"
                            value={assigneeId}
                            onChange={filterSetter(setAssigneeId)}
                            options={[
                                { value: "all", label: "ทุกคน" },
                                { value: "unassigned", label: "ยังไม่มอบหมาย" },
                                ...(session?.user?.id
                                    ? [{ value: session.user.id, label: "งานของฉัน" }]
                                    : []),
                            ]}
                        />
                    )}
                    <div className="flex items-end gap-2">
                        <div>
                            <label className="text-muted-foreground mb-1 block text-xs">ตั้งแต่วันที่</label>
                            <Input
                                type="date"
                                value={from}
                                onChange={(e) => filterSetter(setFrom)(e.target.value)}
                                className="h-9 w-[150px]"
                            />
                        </div>
                        <div>
                            <label className="text-muted-foreground mb-1 block text-xs">ถึงวันที่</label>
                            <Input
                                type="date"
                                value={to}
                                onChange={(e) => filterSetter(setTo)(e.target.value)}
                                className="h-9 w-[150px]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ตาราง */}
            <Card className="overflow-hidden py-0">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <div className="min-w-[1080px]">
                            {/* หัวตาราง */}
                            <div className="text-muted-foreground bg-muted/50 grid grid-cols-[150px_minmax(0,2.2fr)_minmax(0,1.3fr)_110px_140px_minmax(0,1.2fr)_170px_32px] gap-3 px-6 py-3 text-xs font-medium">
                                <span>เลขที่</span>
                                <span>หัวข้อ</span>
                                <span>หมวดหมู่</span>
                                <span>ความสำคัญ</span>
                                <span>สถานะ</span>
                                <span>ผู้รับผิดชอบ</span>
                                <span>SLA</span>
                                <span />
                            </div>

                            {loading ? (
                                <div className="space-y-3 p-6">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="text-muted-foreground p-12 text-center text-sm">
                                    <TicketIcon className="mx-auto mb-3 size-8 opacity-40" />
                                    ไม่พบ Ticket ตามเงื่อนไขที่เลือก
                                </div>
                            ) : (
                                tickets.map((t, i) => (
                                    <Link
                                        key={t.id}
                                        href={`/service/tickets/${t.id}`}
                                        className={
                                            "hover:bg-accent/50 grid grid-cols-[150px_minmax(0,2.2fr)_minmax(0,1.3fr)_110px_140px_minmax(0,1.2fr)_170px_32px] items-center gap-3 px-6 py-3.5 transition-colors" +
                                            (i > 0 ? " border-t" : "")
                                        }
                                    >
                                        <span className="text-muted-foreground font-mono text-xs">
                                            {t.ticketNo}
                                        </span>
                                        <span className="truncate text-sm font-medium">{t.title}</span>
                                        <span className="text-muted-foreground truncate text-sm">
                                            {t.category.name}
                                        </span>
                                        <PriorityBadge priority={t.priority} />
                                        <StatusBadge status={t.status} />
                                        <PersonChip person={t.assignee} />
                                        <SlaIndicator sla={t.sla} />
                                        <ChevronRight className="text-muted-foreground size-4" />
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                    {total === 0
                        ? "ไม่มีรายการ"
                        : `แสดง ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} จาก ${total} รายการ`}
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
    value: number
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

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <div>
            <label className="text-muted-foreground mb-1 block text-xs">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="border-input bg-background h-9 min-w-[160px] rounded-md border px-3 text-sm"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    )
}
