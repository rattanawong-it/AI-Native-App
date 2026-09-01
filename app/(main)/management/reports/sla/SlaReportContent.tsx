"use client"

// รายงาน SLA Compliance (F4.10) + รายการ Ticket ที่เกินกำหนด (F4.11)
//
// ตัวเลข % คิดจากใบที่ "รู้ผลแล้ว" เท่านั้น — ทำเสร็จแล้ว หรือเลยกำหนดไปแล้ว
// ใบที่ยังอยู่ในกำหนดไม่ถูกนับ เพื่อไม่ให้ % แกว่งตามเวลาที่เปิดดู (ดู lib/sla-service.ts)

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Download, FileWarning, RefreshCw, Timer } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PriorityBadge, StatusBadge, PersonChip } from "@/components/ticket/ticket-badges"
import { PRIORITY_LEVELS, PRIORITY_LABEL } from "@/lib/priority"
import {
    readError,
    formatThaiDateTime,
    describeBreach,
    type Category,
    type DirectoryAgent,
    type SlaGroup,
    type SlaReport,
    type SlaStat,
    type TicketListResponse,
    type TicketRow,
} from "@/lib/ticket-types"

interface Filters {
    from: string
    to: string
    categoryId: string
    assigneeId: string
    priority: string
}

/// วันที่ ISO ตามเวลาไทย (ปฏิทินที่ผู้ใช้เห็นบนหน้าจอ)
function thaiIsoDate(offsetDays = 0): string {
    const d = new Date(Date.now() + 7 * 60 * 60 * 1000)
    d.setUTCDate(d.getUTCDate() + offsetDays)
    return d.toISOString().slice(0, 10)
}

const DEFAULT_FILTERS: Filters = {
    from: thaiIsoDate(-29),
    to: thaiIsoDate(),
    categoryId: "",
    assigneeId: "",
    priority: "",
}

function toQuery(f: Filters, extra: Record<string, string> = {}): string {
    const params = new URLSearchParams()
    if (f.from) params.set("from", f.from)
    if (f.to) params.set("to", f.to)
    if (f.categoryId) params.set("categoryId", f.categoryId)
    if (f.assigneeId) params.set("assigneeId", f.assigneeId)
    if (f.priority) params.set("priority", f.priority)
    for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return params.toString()
}

/// "94.5%" — null เมื่อยังไม่มีใบที่รู้ผลในกลุ่มนั้น
function ratePct(rate: number | null): string {
    return rate === null ? "—" : `${rate}%`
}

/// สีของตัวเลข % ตามเกณฑ์ที่ใช้ทั้งระบบ — ≥ 90 เขียว · ≥ 75 เหลือง · ต่ำกว่านั้นแดง
function rateClass(rate: number | null): string {
    if (rate === null) return "text-muted-foreground"
    if (rate >= 90) return "text-sla-ontime"
    if (rate >= 75) return "text-sla-atrisk"
    return "text-sla-breached"
}

export default function SlaReportContent() {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
    const [report, setReport] = useState<SlaReport | null>(null)
    const [breaches, setBreaches] = useState<TicketRow[]>([])
    const [breachTotal, setBreachTotal] = useState(0)
    const [categories, setCategories] = useState<Category[]>([])
    const [agents, setAgents] = useState<DirectoryAgent[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async (f: Filters) => {
        setLoading(true)
        try {
            const [reportRes, breachRes] = await Promise.all([
                fetch(`/api/reports/sla?${toQuery(f)}`),
                // F4.11 — ใช้ API รายการเดิม จึงได้ฟิลเตอร์/สิทธิ์/ส่งออก Excel ชุดเดียวกัน
                fetch(`/api/tickets?${toQuery(f, { breached: "any", sort: "due", pageSize: "50" })}`),
            ])

            if (!reportRes.ok) {
                toast.error(await readError(reportRes, "ไม่สามารถออกรายงาน SLA ได้"))
                return
            }
            setReport((await reportRes.json()) as SlaReport)

            if (breachRes.ok) {
                const data = (await breachRes.json()) as TicketListResponse
                setBreaches(data.tickets)
                setBreachTotal(data.total)
            }
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load(applied)
    }, [load, applied])

    useEffect(() => {
        void (async () => {
            const [catRes, dirRes] = await Promise.all([
                fetch("/api/categories?all=1"),
                fetch("/api/directory?scope=agents"),
            ])
            if (catRes.ok) {
                const d = (await catRes.json()) as { categories: Category[] }
                setCategories(d.categories)
            }
            if (dirRes.ok) {
                const d = (await dirRes.json()) as { agents: DirectoryAgent[] }
                setAgents(d.agents)
            }
        })()
    }, [])

    const scopedToSelf = report?.scope === "own"

    const summary: SlaStat | null = report?.summary ?? null

    const totalBreached = useMemo(() => {
        if (!summary) return 0
        return summary.responseBreached + summary.resolutionBreached
    }, [summary])

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">รายงาน SLA</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        อัตราการทำงานตรงตามกำหนด นับเฉพาะใบที่รู้ผลแล้ว —
                        ทำเสร็จแล้วหรือเลยกำหนดไปแล้ว
                        {scopedToSelf && " · แสดงเฉพาะงานที่คุณรับผิดชอบ"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => void load(applied)}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    <Button asChild variant="outline">
                        <a
                            href={`/api/tickets/export?${toQuery(applied, { breached: "any", sort: "due" })}`}
                        >
                            <Download className="size-4" />
                            ส่งออกใบที่เกินกำหนด
                        </a>
                    </Button>
                </div>
            </div>

            {/* ตัวกรอง */}
            <Card>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <Label className="mb-1.5">ตั้งแต่วันที่แจ้ง</Label>
                        <Input
                            type="date"
                            value={filters.from}
                            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5">ถึงวันที่</Label>
                        <Input
                            type="date"
                            value={filters.to}
                            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5">หมวดหมู่</Label>
                        <select
                            value={filters.categoryId}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, categoryId: e.target.value }))
                            }
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">ทุกหมวดหมู่</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.parentId ? "— " : ""}
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="mb-1.5">เจ้าหน้าที่</Label>
                        <select
                            value={filters.assigneeId}
                            disabled={scopedToSelf}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, assigneeId: e.target.value }))
                            }
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-60"
                        >
                            <option value="">ทุกคน</option>
                            <option value="unassigned">ยังไม่มอบหมาย</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="mb-1.5">ระดับความสำคัญ</Label>
                        <select
                            value={filters.priority}
                            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">ทุกระดับ</option>
                            {PRIORITY_LEVELS.map((p) => (
                                <option key={p} value={p}>
                                    {PRIORITY_LABEL[p]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                        <Button onClick={() => setApplied(filters)}>ดูรายงาน</Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setFilters(DEFAULT_FILTERS)
                                setApplied(DEFAULT_FILTERS)
                            }}
                        >
                            ล้างตัวกรอง
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loading || !report ? (
                <Skeleton className="h-72 w-full" />
            ) : (
                <>
                    {report.truncated && (
                        <Card className="border-priority-high/40 bg-priority-high/5">
                            <CardContent className="flex items-center gap-2 py-4 text-sm">
                                <AlertTriangle className="text-priority-high size-4 shrink-0" />
                                ข้อมูลในช่วงที่เลือกมากเกินกว่าที่รายงานรองรับต่อครั้ง
                                กรุณาแคบช่วงวันที่ลง
                            </CardContent>
                        </Card>
                    )}

                    {/* สรุปรวม */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard
                            label="Ticket ในช่วงที่เลือก"
                            value={String(report.summary.total)}
                        />
                        <SummaryCard
                            label="ตอบกลับตรงเวลา"
                            value={ratePct(report.summary.responseRate)}
                            valueClass={rateClass(report.summary.responseRate)}
                            hint={`${report.summary.responseMet}/${report.summary.responseMeasured} ใบที่รู้ผลแล้ว`}
                        />
                        <SummaryCard
                            label="แก้ไขตรงเวลา"
                            value={ratePct(report.summary.resolutionRate)}
                            valueClass={rateClass(report.summary.resolutionRate)}
                            hint={`${report.summary.resolutionMet}/${report.summary.resolutionMeasured} ใบที่รู้ผลแล้ว`}
                        />
                        <SummaryCard
                            label="ครั้งที่เกินกำหนด"
                            value={String(totalBreached)}
                            valueClass={totalBreached > 0 ? "text-sla-breached" : undefined}
                            hint={`ตอบกลับ ${report.summary.responseBreached} · แก้ไข ${report.summary.resolutionBreached}`}
                        />
                    </div>

                    <Tabs defaultValue="priority">
                        <TabsList>
                            <TabsTrigger value="priority">ตามความสำคัญ</TabsTrigger>
                            <TabsTrigger value="category">ตามหมวดหมู่</TabsTrigger>
                            <TabsTrigger value="assignee">ตามเจ้าหน้าที่</TabsTrigger>
                            <TabsTrigger value="month">ตามช่วงเวลา</TabsTrigger>
                            <TabsTrigger value="breaches">
                                <FileWarning className="size-4" />
                                เกินกำหนด ({breachTotal})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="priority" className="mt-4">
                            <GroupTable
                                title="แยกตามระดับความสำคัญ"
                                rows={report.byPriority}
                                renderLabel={(g) => <PriorityBadge priority={g.key} />}
                            />
                        </TabsContent>
                        <TabsContent value="category" className="mt-4">
                            <GroupTable title="แยกตามหมวดหมู่บริการ" rows={report.byCategory} />
                        </TabsContent>
                        <TabsContent value="assignee" className="mt-4">
                            <GroupTable title="แยกตามเจ้าหน้าที่ผู้รับผิดชอบ" rows={report.byAssignee} />
                        </TabsContent>
                        <TabsContent value="month" className="mt-4">
                            <GroupTable title="แยกตามเดือนที่แจ้ง" rows={report.byMonth} />
                        </TabsContent>

                        <TabsContent value="breaches" className="mt-4">
                            <BreachTable rows={breaches} total={breachTotal} />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    )
}

function SummaryCard({
    label,
    value,
    hint,
    valueClass,
}: {
    label: string
    value: string
    hint?: string
    valueClass?: string
}) {
    return (
        <Card>
            <CardContent>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className={`mt-1 text-2xl font-semibold ${valueClass ?? ""}`}>{value}</p>
                {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
            </CardContent>
        </Card>
    )
}

function GroupTable({
    title,
    rows,
    renderLabel,
}: {
    title: string
    rows: SlaGroup[]
    renderLabel?: (g: SlaGroup) => React.ReactNode
}) {
    return (
        <Card className="overflow-hidden py-0">
            <CardHeader className="bg-muted/40 flex flex-row items-center justify-between border-b py-3">
                <p className="font-medium">{title}</p>
                <span className="text-muted-foreground text-xs">{rows.length} กลุ่ม</span>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <div className="text-muted-foreground py-12 text-center text-sm">
                        <Timer className="mx-auto mb-2 size-6 opacity-40" />
                        ไม่มีข้อมูลในช่วงที่เลือก
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead className="text-muted-foreground border-b text-xs">
                                <tr>
                                    <th className="px-6 py-2 text-left font-medium">กลุ่ม</th>
                                    <th className="px-3 py-2 text-right font-medium">Ticket</th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        ตอบกลับตรงเวลา
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        แก้ไขตรงเวลา
                                    </th>
                                    <th className="px-6 py-2 text-right font-medium">เกินกำหนด</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((g) => (
                                    <tr key={g.key} className="border-b last:border-0">
                                        <td className="px-6 py-3">
                                            {renderLabel ? renderLabel(g) : g.label}
                                        </td>
                                        <td className="px-3 py-3 text-right">{g.total}</td>
                                        <td
                                            className={`px-3 py-3 text-right font-medium ${rateClass(g.responseRate)}`}
                                        >
                                            {ratePct(g.responseRate)}
                                            <span className="text-muted-foreground ml-1 text-xs font-normal">
                                                ({g.responseMet}/{g.responseMeasured})
                                            </span>
                                        </td>
                                        <td
                                            className={`px-3 py-3 text-right font-medium ${rateClass(g.resolutionRate)}`}
                                        >
                                            {ratePct(g.resolutionRate)}
                                            <span className="text-muted-foreground ml-1 text-xs font-normal">
                                                ({g.resolutionMet}/{g.resolutionMeasured})
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {g.responseBreached + g.resolutionBreached}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

/// F4.11 — ตาราง Ticket ที่เกินกำหนด พร้อมเหตุผลว่าเกินตรงไหน
function BreachTable({ rows, total }: { rows: TicketRow[]; total: number }) {
    return (
        <Card className="overflow-hidden py-0">
            <CardHeader className="bg-muted/40 flex flex-row flex-wrap items-center justify-between gap-2 border-b py-3">
                <div>
                    <p className="font-medium">Ticket ที่เกินกำหนด</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        เรียงตามกำหนดแก้ไขที่ใกล้ที่สุด · แสดง {rows.length} จาก {total} ใบ
                    </p>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <div className="text-muted-foreground py-12 text-center text-sm">
                        <Timer className="mx-auto mb-2 size-6 opacity-40" />
                        ไม่มี Ticket ที่เกินกำหนดในช่วงที่เลือก
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead className="text-muted-foreground border-b text-xs">
                                <tr>
                                    <th className="px-6 py-2 text-left font-medium">Ticket</th>
                                    <th className="px-3 py-2 text-left font-medium">ความสำคัญ</th>
                                    <th className="px-3 py-2 text-left font-medium">สถานะ</th>
                                    <th className="px-3 py-2 text-left font-medium">ผู้รับผิดชอบ</th>
                                    <th className="px-3 py-2 text-left font-medium">กำหนดแก้ไข</th>
                                    <th className="px-6 py-2 text-left font-medium">เหตุผล</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((t) => (
                                    <tr key={t.id} className="border-b last:border-0">
                                        <td className="px-6 py-3">
                                            <Link
                                                href={`/service/tickets/${t.id}`}
                                                className="hover:underline"
                                            >
                                                <span className="text-muted-foreground font-mono text-xs">
                                                    {t.ticketNo}
                                                </span>
                                                <span className="mt-0.5 block max-w-[280px] truncate font-medium">
                                                    {t.title}
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3">
                                            <PriorityBadge priority={t.priority} />
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge status={t.status} />
                                        </td>
                                        <td className="px-3 py-3">
                                            <PersonChip person={t.assignee} size={24} />
                                        </td>
                                        <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                                            {formatThaiDateTime(t.resolutionDueAt)}
                                        </td>
                                        <td className="text-sla-breached px-6 py-3 text-xs">
                                            {describeBreach(t).join(" · ") || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
