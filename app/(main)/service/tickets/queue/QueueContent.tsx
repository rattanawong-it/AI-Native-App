"use client"

// หน้าคิวงานทีม — จัดกลุ่มตามระดับความสำคัญ + แสดงภาระงานรายคน
// อ้างอิง F2.9 (คิวงานทีม) และ F2.5 (เรียง Priority DESC → resolutionDueAt ASC)

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, RefreshCw, Users, Inbox } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
    PriorityBadge,
    StatusBadge,
    SlaIndicator,
    PersonChip,
} from "@/components/ticket/ticket-badges"
import { PRIORITY_LEVELS, PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { OPEN_STATUSES } from "@/lib/ticket-workflow"
import { readError, type TicketListResponse, type TicketRow } from "@/lib/ticket-types"

/// ดึงคิวงานทั้งหมดที่ยังไม่ปิด — หน้าเดียวพอเพราะคิวงานจริงไม่ควรค้างเกินนี้
const QUEUE_PAGE_SIZE = 100

export default function QueueContent() {
    const [tickets, setTickets] = useState<TicketRow[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                status: OPEN_STATUSES.join(","),
                sort: "queue",
                page: "1",
                pageSize: String(QUEUE_PAGE_SIZE),
            })
            const res = await fetch(`/api/tickets?${params.toString()}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดคิวงานได้"))
                return
            }
            const data = (await res.json()) as TicketListResponse
            setTickets(data.tickets)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    /// จัดกลุ่มตาม Priority — ภายในกลุ่มเรียงตามลำดับที่ API ส่งมาแล้ว (F2.5)
    const groups = useMemo(
        () =>
            PRIORITY_LEVELS.map((p) => ({
                priority: p,
                rows: tickets.filter((t) => t.priority === p),
            })),
        [tickets]
    )

    /// ภาระงานรายคน — นับจากคิวที่ยังไม่ปิด
    const workload = useMemo(() => {
        const map = new Map<
            string,
            { name: string; image: string | null; total: number; critical: number; breached: number }
        >()
        let unassigned = 0

        for (const t of tickets) {
            if (!t.assignee) {
                unassigned++
                continue
            }
            const entry = map.get(t.assignee.id) ?? {
                name: t.assignee.name,
                image: t.assignee.image,
                total: 0,
                critical: 0,
                breached: 0,
            }
            entry.total++
            if (t.priority === "critical") entry.critical++
            if (t.sla?.status === "breached") entry.breached++
            map.set(t.assignee.id, entry)
        }

        const people = [...map.entries()]
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.total - a.total)
        const max = people.reduce((m, p) => Math.max(m, p.total), 0)
        return { people, unassigned, max }
    }, [tickets])

    return (
        <div className="space-y-6">
            <Link
                href="/service/tickets"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
                <ChevronLeft className="size-4" />
                กลับไป Ticket ทั้งหมด
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">คิวงานทีม</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        งานที่ยังไม่ปิด {tickets.length} รายการ — เรียงตามระดับความสำคัญและกำหนดเวลาแก้ไข
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={() => void load()}>
                    <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                    <span className="sr-only">รีเฟรช</span>
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] lg:items-start">
                {/* คิวงานจัดกลุ่มตาม Priority */}
                <div className="min-w-0 space-y-4">
                    {loading ? (
                        <Skeleton className="h-64 w-full" />
                    ) : tickets.length === 0 ? (
                        <Card>
                            <CardContent className="text-muted-foreground py-14 text-center text-sm">
                                <Inbox className="mx-auto mb-3 size-8 opacity-40" />
                                ไม่มีงานค้างในคิว
                            </CardContent>
                        </Card>
                    ) : (
                        groups
                            .filter((g) => g.rows.length > 0)
                            .map((g) => (
                                <Card key={g.priority} className="overflow-hidden py-0">
                                    <CardHeader className="bg-muted/40 flex-row items-center gap-3 border-b py-3">
                                        <PriorityBadge priority={g.priority} />
                                        <span className="text-muted-foreground text-sm">
                                            {g.rows.length} รายการ
                                        </span>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {g.rows.map((t, i) => (
                                            <Link
                                                key={t.id}
                                                href={`/service/tickets/${t.id}`}
                                                className={
                                                    "hover:bg-accent/50 flex flex-wrap items-center gap-3 px-5 py-3 transition-colors" +
                                                    (i > 0 ? " border-t" : "")
                                                }
                                            >
                                                <span className="text-muted-foreground w-[130px] shrink-0 font-mono text-xs">
                                                    {t.ticketNo}
                                                </span>
                                                <span className="min-w-[180px] flex-1 truncate text-sm font-medium">
                                                    {t.title}
                                                </span>
                                                <StatusBadge status={t.status} />
                                                <span className="w-[150px] shrink-0">
                                                    <PersonChip person={t.assignee} />
                                                </span>
                                                <span className="w-[170px] shrink-0">
                                                    <SlaIndicator sla={t.sla} />
                                                </span>
                                                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                                            </Link>
                                        ))}
                                    </CardContent>
                                </Card>
                            ))
                    )}
                </div>

                {/* ภาระงานรายคน */}
                <Card>
                    <CardHeader>
                        <h2 className="flex items-center gap-2 font-medium">
                            <Users className="size-4" />
                            ภาระงานรายคน
                        </h2>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <Skeleton className="h-40 w-full" />
                        ) : workload.people.length === 0 ? (
                            <p className="text-muted-foreground text-sm">ยังไม่มีงานที่มอบหมาย</p>
                        ) : (
                            workload.people.map((p) => (
                                <div key={p.id} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <PersonChip person={{ name: p.name, image: p.image }} />
                                        <span className="text-sm font-medium">{p.total}</span>
                                    </div>
                                    <Progress
                                        value={workload.max > 0 ? (p.total / workload.max) * 100 : 0}
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        {p.critical > 0 && `วิกฤต ${p.critical} · `}
                                        {p.breached > 0 ? `เกิน SLA ${p.breached}` : "ไม่มีงานเกิน SLA"}
                                    </p>
                                </div>
                            ))
                        )}

                        {workload.unassigned > 0 && (
                            <div className="border-t pt-4">
                                <Link
                                    href="/service/tickets?assigneeId=unassigned"
                                    className="text-priority-critical-fg text-sm font-medium hover:underline"
                                >
                                    ยังไม่มอบหมาย {workload.unassigned} รายการ
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* สรุปตามระดับความสำคัญ */}
            {!loading && tickets.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {groups.map((g) => (
                        <Card key={g.priority}>
                            <CardContent className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-sm">
                                    {PRIORITY_LABEL[g.priority as Priority]}
                                </span>
                                <span className="text-xl font-semibold">{g.rows.length}</span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
