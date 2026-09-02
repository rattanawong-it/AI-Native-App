"use client"

// รายงานภาระงานเจ้าหน้าที่ — ชั่วโมงที่บันทึกไว้รายคน (F3.8)
// อ้างอิง spec §8 ③ F3.8 · สิทธิ์ตาม §7: หัวหน้าขึ้นไปเท่านั้น (API บังคับซ้ำอีกชั้น)
//
// ตัวเลขทั้งหมดมาจาก `WorkLog` ที่เจ้าหน้าที่กรอกเอง — ไม่ใช่การจับเวลาอัตโนมัติ
// จึงสะท้อน "เวลาที่รายงาน" ไม่ใช่ "เวลาที่ใช้จริง" หน้าจอเขียนกำกับไว้ให้ผู้อ่านรู้

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw, Users, Timer, CalendarRange, Info } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { readError, formatThaiDate } from "@/lib/ticket-types"
import { formatHours, type WorkLogSummary } from "@/lib/worklog-types"

const PERIODS = [
    { key: "day", label: "รายวัน" },
    { key: "week", label: "รายสัปดาห์" },
    { key: "month", label: "รายเดือน" },
] as const

type Period = (typeof PERIODS)[number]["key"]

/// วันนี้ตามปฏิทินไทย — ค่าเริ่มต้นของช่องวันอ้างอิง
function todayInput(): string {
    return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function WorkloadReportContent() {
    const [period, setPeriod] = useState<Period>("week")
    const [date, setDate] = useState(todayInput())
    const [data, setData] = useState<WorkLogSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [denied, setDenied] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(
                `/api/worklogs/summary?period=${period}&scope=team&date=${date}`
            )
            if (res.status === 403) {
                setDenied(true)
                return
            }
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายงานภาระงานได้"))
                return
            }
            setDenied(false)
            setData((await res.json()) as WorkLogSummary)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [period, date])

    useEffect(() => {
        void load()
    }, [load])

    /// ความกว้างของแถบเทียบกับคนที่ลงชั่วโมงมากที่สุด
    const maxHours = useMemo(
        () => Math.max(1, ...(data?.byUser ?? []).map((u) => u.hours)),
        [data]
    )

    if (denied) {
        return (
            <div className="space-y-6">
                <BackLink />
                <Card>
                    <CardContent className="text-muted-foreground py-12 text-center text-sm">
                        รายงานภาระงานเปิดให้เฉพาะหัวหน้าขึ้นไป
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <BackLink />

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        รายงานภาระงานเจ้าหน้าที่
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        ชั่วโมงทำงานที่เจ้าหน้าที่บันทึกไว้ในช่วงที่เลือก พร้อมจำนวน Ticket
                        ที่ยังค้างอยู่ในมือแต่ละคน
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={() => void load()}>
                    <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                    <span className="sr-only">รีเฟรช</span>
                </Button>
            </div>

            {/* ตัวเลือกช่วงเวลา */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap gap-2">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={
                                period === p.key
                                    ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                                    : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                            }
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs">วันอ้างอิง</label>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-9 w-[160px]"
                    />
                </div>
            </div>

            {/* การ์ดสรุป */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    icon={<Timer className="size-5" />}
                    label="ชั่วโมงรวมทั้งศูนย์"
                    value={data ? formatHours(data.totalHours) : "-"}
                    tone="bg-brand-tint text-brand"
                />
                <StatCard
                    icon={<Users className="size-5" />}
                    label="เจ้าหน้าที่ที่ลงเวลา"
                    value={data ? String(data.byUser.length) : "-"}
                    tone="bg-status-assigned-bg text-status-assigned-fg"
                />
                <StatCard
                    icon={<CalendarRange className="size-5" />}
                    label="ช่วงที่แสดง"
                    value={
                        data
                            ? `${formatThaiDate(data.range.from)} – ${formatThaiDate(data.range.to)}`
                            : "-"
                    }
                    tone="bg-status-progress-bg text-status-progress-fg"
                    small
                />
            </div>

            {/* ตารางรายคน */}
            <Card className="overflow-hidden py-0">
                <CardContent className="p-0">
                    <div className="text-muted-foreground bg-muted/50 grid grid-cols-[minmax(0,1.6fr)_120px_120px_minmax(0,2fr)] gap-3 px-6 py-3 text-xs font-medium">
                        <span>เจ้าหน้าที่</span>
                        <span className="text-right">ชั่วโมงรวม</span>
                        <span className="text-right">Ticket ค้าง</span>
                        <span>สัดส่วนภาระงาน</span>
                    </div>

                    {loading ? (
                        <div className="space-y-3 p-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : !data || data.byUser.length === 0 ? (
                        <div className="text-muted-foreground p-12 text-center text-sm">
                            <Users className="mx-auto mb-3 size-8 opacity-40" />
                            ยังไม่มีเจ้าหน้าที่คนใดบันทึกเวลาในช่วงนี้
                        </div>
                    ) : (
                        data.byUser.map((u, i) => (
                            <div
                                key={u.key}
                                className={
                                    "grid grid-cols-[minmax(0,1.6fr)_120px_120px_minmax(0,2fr)] items-center gap-3 px-6 py-3.5" +
                                    (i > 0 ? " border-t" : "")
                                }
                            >
                                <span className="truncate text-sm font-medium">{u.label}</span>
                                <span className="text-right text-sm">{formatHours(u.hours)}</span>
                                <span className="text-muted-foreground text-right text-sm">
                                    {u.openTickets}
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                                        <div
                                            className="bg-brand h-full rounded-full"
                                            style={{ width: `${(u.hours / maxHours) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-muted-foreground w-14 text-right text-xs">
                                        {u.entries} รายการ
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* แยกตามประเภทงาน */}
            <Card>
                <CardHeader className="pb-0">
                    <p className="text-sm font-medium">ชั่วโมงแยกตามประเภทงาน</p>
                </CardHeader>
                <CardContent>
                    {loading || !data ? (
                        <Skeleton className="h-16 w-full" />
                    ) : data.byRefType.length === 0 ? (
                        <p className="text-muted-foreground text-sm">ยังไม่มีข้อมูลในช่วงนี้</p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {data.byRefType.map((r) => (
                                <div key={r.key} className="rounded-lg border p-3">
                                    <p className="text-muted-foreground text-xs">{r.label}</p>
                                    <p className="mt-1 text-lg font-semibold">
                                        {formatHours(r.hours)}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {r.entries} รายการ
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="text-muted-foreground flex gap-3 text-sm">
                    <Info className="mt-0.5 size-4 shrink-0 opacity-60" />
                    <span>
                        ตัวเลขมาจากบันทึกเวลาที่เจ้าหน้าที่กรอกเอง (Manual Time Log)
                        ไม่ใช่การจับเวลาอัตโนมัติ · เจ้าหน้าที่ที่ไม่ได้ลงเวลาจะไม่ปรากฏในตาราง
                        แม้จะมีงานอยู่ในมือ
                    </span>
                </CardContent>
            </Card>
        </div>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

function BackLink() {
    return (
        <Link
            href="/management/reports"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
            <ArrowLeft className="size-4" />
            กลับไปหน้ารายงาน
        </Link>
    )
}

function StatCard({
    icon,
    label,
    value,
    tone,
    small,
}: {
    icon: React.ReactNode
    label: string
    value: string
    tone: string
    small?: boolean
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-muted-foreground truncate text-sm">{label}</p>
                    <p className={small ? "text-sm font-semibold" : "text-2xl font-semibold"}>
                        {value}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
