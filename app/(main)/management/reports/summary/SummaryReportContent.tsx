"use client"

// รายงานสรุปประจำเดือน / ไตรมาส (F7.15–F7.23)
//
// จงใจ **ไม่ใช้แท็บ** — หน้านี้คือเอกสารฉบับเดียวที่ต้องส่งผู้บริหาร ทุกส่วนจึงเรียงต่อกันลงมา
// กดพิมพ์ครั้งเดียวได้ครบทั้งฉบับ (F7.22 ฝั่ง PDF ใช้การพิมพ์ผ่านเบราว์เซอร์ตามที่ตกลงไว้
// เพื่อไม่ต้องเพิ่ม dependency และไม่มีปัญหาฟอนต์ไทย)

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    CameraIcon,
    Download,
    Printer,
    RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { GroupBarChart, SlaTrendChart, TicketTrendChart } from "@/components/report/report-charts"
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/task-board"
import { readError, formatThaiDate } from "@/lib/ticket-types"
import type {
    Metric,
    PeriodType,
    SnapshotRow,
    SummaryReport,
} from "@/lib/report-types"

interface Filters {
    type: PeriodType
    month: string
    quarter: string
    from: string
    to: string
}

/// วันนี้ตามปฏิทินไทย — ค่าเริ่มต้นของตัวเลือกช่วงเวลา
function thaiIsoDate(offsetDays = 0): string {
    const d = new Date(Date.now() + 7 * 60 * 60 * 1000)
    d.setUTCDate(d.getUTCDate() + offsetDays)
    return d.toISOString().slice(0, 10)
}

function currentQuarter(): string {
    const today = thaiIsoDate()
    const month = Number(today.slice(5, 7))
    return `${today.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`
}

const DEFAULT_FILTERS: Filters = {
    type: "month",
    month: thaiIsoDate().slice(0, 7),
    quarter: currentQuarter(),
    from: thaiIsoDate(-29),
    to: thaiIsoDate(),
}

/// ย้อนหลัง 8 ไตรมาสจากไตรมาสปัจจุบัน — พอสำหรับรายงานเทียบสองปี
function quarterOptions(): { value: string; label: string }[] {
    const [yRaw, qRaw] = currentQuarter().split("-Q")
    let y = Number(yRaw)
    let q = Number(qRaw)
    const out: { value: string; label: string }[] = []

    for (let i = 0; i < 8; i++) {
        out.push({ value: `${y}-Q${q}`, label: `ไตรมาส ${q}/${y + 543}` })
        q -= 1
        if (q === 0) {
            q = 4
            y -= 1
        }
    }
    return out
}

function toQuery(f: Filters): string {
    const params = new URLSearchParams({ type: f.type })
    if (f.type === "month") params.set("month", f.month)
    if (f.type === "quarter") params.set("quarter", f.quarter)
    if (f.type === "custom") {
        params.set("from", f.from)
        params.set("to", f.to)
    }
    return params.toString()
}

function num(value: number): string {
    return value.toLocaleString("th-TH")
}

function baht(value: number): string {
    return value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
}

function ratePct(rate: number | null): string {
    return rate === null ? "—" : `${rate}%`
}

/// เกณฑ์สี % ตรงเวลาชุดเดียวกับรายงาน SLA — ≥ 90 เขียว · ≥ 75 เหลือง · ต่ำกว่านั้นแดง
function rateClass(rate: number | null): string {
    if (rate === null) return "text-muted-foreground"
    if (rate >= 90) return "text-sla-ontime"
    if (rate >= 75) return "text-sla-atrisk"
    return "text-sla-breached"
}

export default function SummaryReportContent() {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
    const [report, setReport] = useState<SummaryReport | null>(null)
    const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const quarters = useMemo(quarterOptions, [])
    const canExport = report?.scope === "all"

    const load = useCallback(async (f: Filters) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/reports/summary?${toQuery(f)}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถออกรายงานสรุปได้"))
                return
            }
            const data = (await res.json()) as { report: SummaryReport }
            setReport(data.report)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    const loadSnapshots = useCallback(async () => {
        // agent ไม่มีสิทธิ์อ่าน Snapshot — เงียบไว้ ไม่ต้องขึ้น error ให้รก
        const res = await fetch("/api/reports/snapshots")
        if (!res.ok) return
        const data = (await res.json()) as { snapshots: SnapshotRow[] }
        setSnapshots(data.snapshots)
    }, [])

    useEffect(() => {
        void load(applied)
    }, [load, applied])

    useEffect(() => {
        void loadSnapshots()
    }, [loadSnapshots])

    async function saveSnapshot() {
        setSaving(true)
        try {
            const res = await fetch(`/api/reports/snapshots?${toQuery(applied)}`, { method: "POST" })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึก Snapshot ไม่สำเร็จ"))
                return
            }
            toast.success("บันทึก Snapshot ของช่วงนี้แล้ว")
            await loadSnapshots()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* กติกาการพิมพ์ — layout หลักตั้ง h-screen + overflow ไว้ ต้องคลายออกก่อน
                ไม่งั้นเบราว์เซอร์จะพิมพ์ได้แค่หน้าแรกหน้าเดียว */}
            <style>{`
                @media print {
                    html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
                    body * { visibility: visible; }
                    aside, header, .no-print { display: none !important; }
                    main { overflow: visible !important; padding: 0 !important; }
                    main > div, body > div, body > div > div {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    .print-break { break-inside: avoid; page-break-inside: avoid; }
                    @page { margin: 14mm; }
                }
            `}</style>

            {/* ─── หัวรายงาน ─────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">รายงานสรุปผลการดำเนินงาน</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {report ? (
                            <>
                                {report.period.label}
                                {report.previousPeriod && ` · เทียบกับ ${report.previousPeriod.label}`}
                                {report.scope === "own" && " · แสดงเฉพาะงานที่คุณรับผิดชอบ"}
                            </>
                        ) : (
                            "กำลังโหลด…"
                        )}
                    </p>
                </div>

                <div className="no-print flex flex-wrap gap-2">
                    <Button variant="outline" size="icon" onClick={() => void load(applied)}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="size-4" />
                        พิมพ์ / บันทึก PDF
                    </Button>
                    {canExport && (
                        <>
                            <Button asChild variant="outline">
                                <a href={`/api/reports/export?${toQuery(applied)}`}>
                                    <Download className="size-4" />
                                    ส่งออก Excel
                                </a>
                            </Button>
                            <Button onClick={() => void saveSnapshot()} disabled={saving}>
                                <CameraIcon className="size-4" />
                                {saving ? "กำลังบันทึก…" : "บันทึก Snapshot"}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ─── ตัวเลือกช่วงเวลา (F7.15) ────────────────── */}
            <Card className="no-print">
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <Label className="mb-1.5">ช่วงเวลา</Label>
                        <select
                            value={filters.type}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, type: e.target.value as PeriodType }))
                            }
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="month">รายเดือน</option>
                            <option value="quarter">รายไตรมาส</option>
                            <option value="custom">กำหนดเอง</option>
                        </select>
                    </div>

                    {filters.type === "month" && (
                        <div>
                            <Label className="mb-1.5">เดือน</Label>
                            <Input
                                type="month"
                                value={filters.month}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, month: e.target.value }))
                                }
                            />
                        </div>
                    )}

                    {filters.type === "quarter" && (
                        <div>
                            <Label className="mb-1.5">ไตรมาส</Label>
                            <select
                                value={filters.quarter}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, quarter: e.target.value }))
                                }
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                {quarters.map((q) => (
                                    <option key={q.value} value={q.value}>
                                        {q.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filters.type === "custom" && (
                        <>
                            <div>
                                <Label className="mb-1.5">ตั้งแต่วันที่</Label>
                                <Input
                                    type="date"
                                    value={filters.from}
                                    onChange={(e) =>
                                        setFilters((f) => ({ ...f, from: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">ถึงวันที่</Label>
                                <Input
                                    type="date"
                                    value={filters.to}
                                    onChange={(e) =>
                                        setFilters((f) => ({ ...f, to: e.target.value }))
                                    }
                                />
                            </div>
                        </>
                    )}

                    <div className="flex items-end gap-2">
                        <Button onClick={() => setApplied(filters)}>ดูรายงาน</Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setFilters(DEFAULT_FILTERS)
                                setApplied(DEFAULT_FILTERS)
                            }}
                        >
                            ล้าง
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loading || !report ? (
                <Skeleton className="h-96 w-full" />
            ) : (
                <>
                    {report.truncated && (
                        <Card className="border-priority-high/40 bg-priority-high/5">
                            <CardContent className="flex items-center gap-2 py-4 text-sm">
                                <AlertTriangle className="text-priority-high size-4 shrink-0" />
                                ข้อมูลในช่วงที่เลือกมากเกินกว่าที่รายงานรองรับต่อครั้ง
                                ตัวเลขยังไม่ครบทั้งช่วง — กรุณาแคบช่วงวันที่ลง
                            </CardContent>
                        </Card>
                    )}

                    {/* ─── ① ตัวเลขหลัก (F7.16) ──────────────── */}
                    <Section title="ภาพรวม Ticket" hint="เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard label="รับเข้า" metric={report.tickets.created} unit="ใบ" />
                            <MetricCard
                                label="แก้ไขแล้ว"
                                metric={report.tickets.resolved}
                                unit="ใบ"
                            />
                            <MetricCard label="ปิดงาน" metric={report.tickets.closed} unit="ใบ" />
                            <MetricCard
                                label="ค้าง ณ สิ้นช่วง"
                                metric={report.tickets.pending}
                                unit="ใบ"
                                /// ค้างเยอะขึ้น = แย่ลง จึงกลับทิศการอ่านสีของลูกศร
                                lowerIsBetter
                            />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <StatCard
                                label="เวลาเฉลี่ยที่ใช้แก้ไข"
                                value={
                                    report.tickets.avgResolutionHours === null
                                        ? "—"
                                        : `${report.tickets.avgResolutionHours} ชม.`
                                }
                                hint="นับจากเวลาแจ้งถึงเวลาแก้เสร็จ ของใบที่แจ้งในช่วงนี้"
                            />
                            <StatCard
                                label="SLA ตอบกลับตรงเวลา"
                                value={ratePct(report.sla.responseRate)}
                                valueClass={rateClass(report.sla.responseRate)}
                                hint={`${report.sla.responseMet}/${report.sla.responseMeasured} ใบที่รู้ผลแล้ว`}
                            />
                            <StatCard
                                label="SLA แก้ไขตรงเวลา"
                                value={ratePct(report.sla.resolutionRate)}
                                valueClass={rateClass(report.sla.resolutionRate)}
                                hint={
                                    report.sla.previousResolutionRate === null
                                        ? `${report.sla.resolutionMet}/${report.sla.resolutionMeasured} ใบที่รู้ผลแล้ว`
                                        : `ช่วงก่อนหน้า ${report.sla.previousResolutionRate}% · เกินกำหนด ${report.sla.breached} ครั้ง`
                                }
                            />
                        </div>
                    </Section>

                    {/* ─── ② แนวโน้ม (F7.21) ─────────────────── */}
                    <Section title="แนวโน้ม" hint="จำนวนใบกับ % SLA แยกกราฟกันเพราะคนละหน่วย">
                        <div className="print-break">
                            <TicketTrendChart
                                points={report.trend.points}
                                granularity={report.trend.granularity}
                            />
                        </div>
                        <div className="print-break">
                            <SlaTrendChart points={report.trend.points} />
                        </div>
                    </Section>

                    {/* ─── ③ สัดส่วนตามมิติ (F7.16) ──────────── */}
                    <Section title="สัดส่วน Ticket ที่แจ้งเข้ามาในช่วงนี้">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="print-break">
                                <GroupBarChart
                                    title="ตามหมวดหมู่บริการ"
                                    groups={report.tickets.byCategory}
                                />
                            </div>
                            <div className="print-break">
                                <GroupBarChart
                                    title="ตามระดับความสำคัญ"
                                    groups={report.tickets.byPriority}
                                    scheme="priority"
                                />
                            </div>
                            <div className="print-break">
                                <GroupBarChart
                                    title="ตามช่องทางที่แจ้ง"
                                    groups={report.tickets.byChannel}
                                />
                            </div>
                            <div className="print-break">
                                <GroupBarChart
                                    title="ตามสถานะปัจจุบัน"
                                    groups={report.tickets.byStatus}
                                    scheme="status"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* ─── ④ ภาระงานเจ้าหน้าที่ (F7.18) ──────── */}
                    <Section
                        title="ภาระงานเจ้าหน้าที่"
                        hint={`ชั่วโมงรวมที่บันทึกไว้ในช่วงนี้ ${report.workload.totalHours} ชม.`}
                        action={
                            <Link
                                href="/management/reports/workload"
                                className="text-primary text-xs hover:underline"
                            >
                                ดูรายงานภาระงานแบบละเอียด →
                            </Link>
                        }
                    >
                        <DataTable
                            headers={[
                                "เจ้าหน้าที่",
                                "ได้รับมอบหมาย",
                                "แก้ไขแล้ว",
                                "ค้างในมือตอนนี้",
                                "ชั่วโมง",
                            ]}
                            empty="ยังไม่มีข้อมูลภาระงานในช่วงที่เลือก"
                            rows={report.workload.rows.map((r) => ({
                                key: r.userId,
                                cells: [
                                    r.name,
                                    num(r.assigned),
                                    num(r.resolved),
                                    num(r.openNow),
                                    `${r.hours}`,
                                ],
                            }))}
                        />
                    </Section>

                    {/* ─── ⑤ ความคืบหน้าโครงการ (F7.19) ──────── */}
                    <Section
                        title="ความคืบหน้าโครงการพัฒนา"
                        hint={`ปิด Task ได้ ${num(report.projects.tasksDone.value)} งานในช่วงนี้`}
                    >
                        <DataTable
                            headers={[
                                "โครงการ",
                                "สถานะ",
                                "ความคืบหน้า",
                                "งานเสร็จ/ทั้งหมด",
                                "เลยกำหนด",
                                "ชั่วโมง",
                            ]}
                            empty="ยังไม่มีโครงการในระบบ"
                            rows={report.projects.rows.map((p) => ({
                                key: p.id,
                                cells: [
                                    `${p.code} · ${p.name}`,
                                    PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status,
                                    `${p.progress}%`,
                                    `${num(p.doneTasks)}/${num(p.totalTasks)}`,
                                    p.overdueTasks > 0 ? (
                                        <span key="ov" className="text-sla-breached font-medium">
                                            {num(p.overdueTasks)}
                                        </span>
                                    ) : (
                                        "-"
                                    ),
                                    `${p.hours}`,
                                ],
                            }))}
                        />
                    </Section>

                    {/* ─── ⑥ ครุภัณฑ์ + คำขออนุมัติ (F7.20) ──── */}
                    <Section title="ครุภัณฑ์และคำขออนุมัติ">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                label="ครุภัณฑ์ทั้งหมด"
                                value={`${num(report.assets.total)} รายการ`}
                            />
                            <MetricCard
                                label="รับเข้าในช่วงนี้"
                                metric={report.assets.purchased}
                                unit="รายการ"
                            />
                            <StatCard
                                label="มูลค่าที่รับเข้า"
                                value={`${baht(report.assets.purchasedValue)} บาท`}
                            />
                            <StatCard
                                label="ใกล้หมดประกัน"
                                value={`${num(report.assets.warrantyExpiring)} รายการ`}
                                valueClass={
                                    report.assets.warrantyExpiring > 0 ? "text-sla-atrisk" : undefined
                                }
                                hint="ภายใน 90 วันนับจากวันสิ้นสุดช่วง"
                            />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="print-break">
                                <GroupBarChart
                                    title="ครุภัณฑ์ตามสถานะ"
                                    groups={report.assets.byStatus}
                                />
                            </div>
                            <div className="print-break">
                                <GroupBarChart
                                    title="ครุภัณฑ์ตามประเภท"
                                    groups={report.assets.byType}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard
                                label="คำขอที่ยื่นเข้ามา"
                                metric={report.approvals.created}
                                unit="ใบ"
                            />
                            <MetricCard
                                label="อนุมัติแล้ว"
                                metric={report.approvals.approved}
                                unit="ใบ"
                            />
                            <StatCard
                                label="รออนุมัติอยู่"
                                value={`${num(report.approvals.pending)} ใบ`}
                                hint="นับ ณ ตอนนี้ ไม่ผูกกับช่วงเวลา"
                            />
                            <StatCard
                                label="มูลค่าที่อนุมัติ"
                                value={`${baht(report.approvals.approvedAmount)} บาท`}
                                hint={`ไม่อนุมัติ ${num(report.approvals.rejected.value)} ใบ`}
                            />
                        </div>
                    </Section>

                    {/* ─── ⑦ Snapshot (F7.23) ────────────────── */}
                    {canExport && (
                        <Section
                            title="เปรียบเทียบย้อนหลัง"
                            hint="ภาพนิ่งของรายงานที่บันทึกไว้ตอนปิดแต่ละช่วง — ตัวเลขไม่เปลี่ยนตามเวลาอีก"
                        >
                            <DataTable
                                headers={[
                                    "ช่วง",
                                    "รับเข้า",
                                    "แก้ไขแล้ว",
                                    "ค้าง",
                                    "SLA แก้ไข",
                                    "ชั่วโมง",
                                    "อนุมัติ",
                                    "บันทึกโดย",
                                ]}
                                empty="ยังไม่มี Snapshot — กดปุ่ม “บันทึก Snapshot” ด้านบนเมื่อปิดรายงานของช่วงนี้"
                                rows={snapshots.map((s) => ({
                                    key: s.id,
                                    cells: [
                                        s.label,
                                        num(s.highlights.ticketsCreated),
                                        num(s.highlights.ticketsResolved),
                                        num(s.highlights.ticketsPending),
                                        <span
                                            key="sla"
                                            className={rateClass(s.highlights.slaResolutionRate)}
                                        >
                                            {ratePct(s.highlights.slaResolutionRate)}
                                        </span>,
                                        `${s.highlights.totalHours}`,
                                        num(s.highlights.approvalsApproved),
                                        `${s.generatedByName ?? "-"} · ${formatThaiDate(s.createdAt)}`,
                                    ],
                                }))}
                            />
                        </Section>
                    )}

                    <p className="text-muted-foreground text-xs">
                        ออกรายงานเมื่อ{" "}
                        {new Date(report.generatedAt).toLocaleString("th-TH", {
                            timeZone: "Asia/Bangkok",
                            dateStyle: "long",
                            timeStyle: "short",
                        })}
                    </p>
                </>
            )}
        </div>
    )
}

// ── ชิ้นส่วนย่อยของหน้า ──────────────────────────────────────────────

function Section({
    title,
    hint,
    action,
    children,
}: {
    title: string
    hint?: string
    action?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                <div>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
                </div>
                {action && <span className="no-print">{action}</span>}
            </div>
            {children}
        </section>
    )
}

function StatCard({
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
        <Card className="print-break">
            <CardContent>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className={`mt-1 text-2xl font-semibold ${valueClass ?? ""}`}>{value}</p>
                {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
            </CardContent>
        </Card>
    )
}

/// การ์ดตัวเลขพร้อมลูกศรเทียบช่วงก่อนหน้า
/// `lowerIsBetter` ใช้กับตัวเลขที่ "น้อยกว่าดีกว่า" เช่นงานค้าง — สีของลูกศรจะกลับทิศ
function MetricCard({
    label,
    metric,
    unit,
    lowerIsBetter = false,
}: {
    label: string
    metric: Metric
    unit: string
    lowerIsBetter?: boolean
}) {
    const up = metric.delta !== null && metric.delta > 0
    const flat = metric.delta === null || metric.delta === 0
    const good = lowerIsBetter ? !up : up

    const Icon = flat ? ArrowRight : up ? ArrowUp : ArrowDown
    const toneClass = flat
        ? "text-muted-foreground"
        : good
          ? "text-sla-ontime"
          : "text-sla-breached"

    return (
        <Card className="print-break">
            <CardContent>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-1 text-2xl font-semibold">
                    {num(metric.value)}
                    <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span>
                </p>
                <p className={`mt-1 flex items-center gap-1 text-xs ${toneClass}`}>
                    <Icon className="size-3.5" />
                    {metric.delta === null ? (
                        "ไม่มีข้อมูลเทียบ"
                    ) : (
                        <>
                            {metric.delta > 0 ? "+" : ""}
                            {num(metric.delta)}
                            {metric.percent !== null && ` (${metric.percent > 0 ? "+" : ""}${metric.percent}%)`}
                            <span className="text-muted-foreground">
                                จาก {num(metric.previous ?? 0)}
                            </span>
                        </>
                    )}
                </p>
            </CardContent>
        </Card>
    )
}

/// ตารางอ่านอย่างเดียวที่ใช้ซ้ำทุกส่วนของรายงาน — คอลัมน์แรกชิดซ้าย ที่เหลือชิดขวา
function DataTable({
    headers,
    rows,
    empty,
}: {
    headers: string[]
    rows: { key: string; cells: React.ReactNode[] }[]
    empty: string
}) {
    return (
        <Card className="print-break overflow-hidden py-0">
            <CardHeader className="sr-only">
                <p>{headers.join(" · ")}</p>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <p className="text-muted-foreground py-12 text-center text-sm">{empty}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead className="text-muted-foreground bg-muted/40 border-b text-xs">
                                <tr>
                                    {headers.map((h, i) => (
                                        <th
                                            key={h}
                                            className={`px-4 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.key} className="border-b last:border-0">
                                        {r.cells.map((c, i) => (
                                            <td
                                                key={i}
                                                className={`px-4 py-3 ${i === 0 ? "text-left font-medium" : "text-right"}`}
                                            >
                                                {c}
                                            </td>
                                        ))}
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
