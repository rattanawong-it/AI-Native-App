"use client"

// แดชบอร์ดแยกตาม role (F9.1–F9.5) + widget งานวันนี้/งานเลยกำหนด (F3.9)
//
// สามชั้นซ้อนกัน ไม่ใช่สามหน้าแยก:
//   requester (student/user) → เห็นเฉพาะ "Ticket ของฉัน"
//   agent                    → + งานที่ต้องทำของตัวเอง
//   manager / admin          → + ภาพรวมทั้งศูนย์ ซึ่งวางไว้บนสุดเพราะเป็นสิ่งที่หัวหน้าเปิดมาดูก่อน
//
// ข้อมูลทั้งหมดมาจาก server เป็น props แล้ว — ไฟล์นี้ไม่ fetch ซ้ำ

import Link from "next/link"
import {
    AlertTriangle,
    ArrowUpRight,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    Clock,
    FilePlus2,
    FileCheck2,
    Inbox,
    Timer,
    TrendingUp,
    UserPlus,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PriorityBadge, StatusBadge } from "@/components/ticket/ticket-badges"
import { GroupBarChart, TicketTrendChart } from "@/components/report/report-charts"
import { formatThaiDateTime } from "@/lib/ticket-types"
import type { WorkItem } from "@/lib/worklog-service"
import type { DashboardData, DashboardTicketBrief } from "@/lib/dashboard-types"

/// เกณฑ์สี % ตรงเวลาชุดเดียวกับรายงาน SLA
function rateClass(rate: number | null): string {
    if (rate === null) return "text-muted-foreground"
    if (rate >= 90) return "text-sla-ontime"
    if (rate >= 75) return "text-sla-atrisk"
    return "text-sla-breached"
}

export default function DashboardContent({ data }: { data: DashboardData }) {
    const { mine, work, center } = data

    return (
        <div className="space-y-6">
            {/* ─── หัวหน้าจอ ──────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        สวัสดี {data.userName}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {data.view === "requester"
                            ? "ติดตามสถานะเรื่องที่คุณแจ้งไว้ได้ที่นี่"
                            : data.view === "agent"
                              ? "สรุปงานที่อยู่ในมือคุณวันนี้"
                              : "ภาพรวมงานบริการของศูนย์ในช่วงที่เลือก"}
                    </p>
                </div>

                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Clock className="size-3.5" />
                    {new Date(data.generatedAt).toLocaleDateString("th-TH", {
                        timeZone: "Asia/Bangkok",
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </div>
            </div>

            {/* ─── ① ภาพรวมทั้งศูนย์ — หัวหน้าขึ้นไป (F9.4, F9.5) ─── */}
            {center && (
                <section className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                        <h2 className="text-lg font-semibold">ภาพรวมทั้งศูนย์</h2>
                        <RangeToggle current={data.rangeDays} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            icon={Inbox}
                            label={`Ticket รับเข้า (${data.rangeDays} วัน)`}
                            value={`${center.created}`}
                            hint={`แก้ไขแล้ว ${center.resolved} ใบในช่วงเดียวกัน`}
                            href="/service/tickets"
                        />
                        <StatCard
                            icon={ClipboardList}
                            label="ค้างอยู่ตอนนี้"
                            value={`${center.pending}`}
                            hint={`ยังไม่มีคนรับ ${center.unassigned} ใบ`}
                            href="/service/tickets?status=new"
                            tone={center.unassigned > 0 ? "warn" : undefined}
                        />
                        <StatCard
                            icon={Timer}
                            label="SLA แก้ไขตรงเวลา"
                            value={center.slaRate === null ? "—" : `${center.slaRate}%`}
                            valueClass={rateClass(center.slaRate)}
                            hint={`เลยกำหนดและยังไม่จบ ${center.breachedOpen} ใบ`}
                            href="/management/reports/sla"
                            tone={center.breachedOpen > 0 ? "danger" : undefined}
                        />
                        <StatCard
                            icon={FileCheck2}
                            label="คำขอรออนุมัติ"
                            value={`${center.pendingApprovals}`}
                            hint="รอการตัดสินใจของหัวหน้า"
                            href="/management/requests"
                            tone={center.pendingApprovals > 0 ? "warn" : undefined}
                        />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <TicketTrendChart
                            points={center.trend}
                            granularity="day"
                            height={240}
                        />
                        <GroupBarChart
                            title="งานที่ค้างอยู่ แยกตามสถานะ"
                            hint="นับ ณ ตอนนี้ ไม่ผูกกับช่วงเวลาที่เลือก"
                            groups={center.byStatus}
                            scheme="status"
                            height={240}
                        />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ListCard
                            title="ภาระงานรายคน"
                            hint="เรียงตามงานค้างในมือ"
                            icon={UserPlus}
                            empty="ยังไม่มีงานที่มอบหมายให้ใคร"
                            href="/management/reports/workload"
                            hrefLabel="ดูรายงานภาระงาน"
                        >
                            {center.topWorkload.map((w) => (
                                <div
                                    key={w.userId}
                                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                                >
                                    <span className="truncate text-sm font-medium">{w.name}</span>
                                    <span className="text-muted-foreground shrink-0 text-xs">
                                        ค้าง {w.openNow} งาน · {w.hours} ชม.
                                    </span>
                                </div>
                            ))}
                        </ListCard>

                        <ListCard
                            title="ความคืบหน้าโครงการ"
                            icon={TrendingUp}
                            empty="ยังไม่มีโครงการที่กำลังดำเนินการ"
                            href="/management/projects"
                            hrefLabel="ดูโครงการทั้งหมด"
                        >
                            {center.projects.map((p) => (
                                <Link
                                    key={p.id}
                                    href={`/management/projects/${p.id}`}
                                    className="hover:bg-muted/50 block px-4 py-2.5 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="truncate text-sm font-medium">
                                            {p.code} · {p.name}
                                        </span>
                                        <span className="text-muted-foreground shrink-0 text-xs">
                                            {p.doneTasks}/{p.totalTasks} งาน
                                        </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                                            <div
                                                className="bg-primary h-full rounded-full"
                                                style={{ width: `${p.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-muted-foreground text-xs">
                                            {p.progress}%
                                        </span>
                                        {p.overdueTasks > 0 && (
                                            <span className="text-sla-breached text-xs">
                                                เลยกำหนด {p.overdueTasks}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </ListCard>
                    </div>
                </section>
            )}

            {/* ─── ② งานของฉัน — เจ้าหน้าที่ขึ้นไป (F9.3, F3.9) ─── */}
            {work && (
                <section className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                        <h2 className="text-lg font-semibold">งานที่อยู่ในมือคุณ</h2>
                        <Link
                            href="/service/my-work"
                            className="text-primary text-xs hover:underline"
                        >
                            เปิด My Work →
                        </Link>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <StatCard
                            icon={ClipboardList}
                            label="Ticket ที่รับผิดชอบ"
                            value={`${work.openNow}`}
                            href="/service/my-work"
                        />
                        <StatCard
                            icon={CalendarClock}
                            label="ครบกำหนดวันนี้"
                            value={`${work.dueToday}`}
                            href="/service/my-work?state=today"
                            tone={work.dueToday > 0 ? "warn" : undefined}
                        />
                        <StatCard
                            icon={AlertTriangle}
                            label="เลยกำหนดแล้ว"
                            value={`${work.overdue}`}
                            href="/service/my-work?state=overdue"
                            tone={work.overdue > 0 ? "danger" : undefined}
                        />
                        <StatCard
                            icon={Timer}
                            label="ใกล้ครบ SLA"
                            value={`${work.atRisk}`}
                            hint="ภายใน 24 ชั่วโมง"
                            href="/service/tickets?sort=due"
                            tone={work.atRisk > 0 ? "warn" : undefined}
                        />
                        <StatCard
                            icon={Clock}
                            label="ชั่วโมงสัปดาห์นี้"
                            value={`${work.hoursThisWeek}`}
                            hint="จาก Time Log ที่บันทึกไว้"
                            href="/service/my-work"
                        />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* F3.9 — งานวันนี้ */}
                        <ListCard
                            title="งานวันนี้"
                            hint="Ticket, Task และ To-do ที่ครบกำหนดวันนี้"
                            icon={CalendarClock}
                            empty="วันนี้ไม่มีงานที่ครบกำหนด"
                            href="/service/my-work?state=today"
                            hrefLabel="ดูทั้งหมด"
                        >
                            {work.dueTodayItems.map((i) => (
                                <WorkRow key={`${i.kind}-${i.id}`} item={i} />
                            ))}
                        </ListCard>

                        {/* F3.9 — งานเลยกำหนด */}
                        <ListCard
                            title="งานเลยกำหนด"
                            hint="ต้องเคลียร์ก่อนงานอื่น"
                            icon={AlertTriangle}
                            empty="ไม่มีงานเลยกำหนด"
                            href="/service/my-work?state=overdue"
                            hrefLabel="ดูทั้งหมด"
                        >
                            {work.overdueItems.map((i) => (
                                <WorkRow key={`${i.kind}-${i.id}`} item={i} overdue />
                            ))}
                        </ListCard>
                    </div>

                    <ListCard
                        title="คิวงานถัดไป"
                        hint="เรียงตามความสำคัญและกำหนดแก้ไข"
                        icon={ClipboardList}
                        empty="ไม่มี Ticket ค้างในมือ"
                        href="/service/tickets?sort=queue"
                        hrefLabel="ดูคิวทั้งหมด"
                    >
                        {work.queue.map((t) => (
                            <TicketRow key={t.id} ticket={t} contextLabel="ผู้แจ้ง" />
                        ))}
                    </ListCard>
                </section>
            )}

            {/* ─── ③ เรื่องที่ฉันแจ้ง — ทุก role (F9.2) ─── */}
            <section className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                    <h2 className="text-lg font-semibold">เรื่องที่ฉันแจ้ง</h2>
                    <Button asChild size="sm">
                        <Link href="/service/tickets/new">
                            <FilePlus2 className="size-4" />
                            แจ้งปัญหาใหม่
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        icon={ClipboardList}
                        label="กำลังดำเนินการ"
                        value={`${mine.open}`}
                        href="/service/tickets"
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="แก้ไขแล้ว รอยืนยัน"
                        value={`${mine.waitingConfirm}`}
                        hint="กดยืนยันเพื่อปิดงานได้เลย"
                        href="/service/tickets?status=resolved"
                        tone={mine.waitingConfirm > 0 ? "warn" : undefined}
                    />
                    <StatCard
                        icon={Inbox}
                        label="แจ้งไปแล้วทั้งหมด"
                        value={`${mine.total}`}
                        href="/service/tickets"
                    />
                </div>

                <ListCard
                    title="เรื่องล่าสุดของฉัน"
                    icon={Inbox}
                    empty="ยังไม่เคยแจ้งเรื่องเข้ามา — กดปุ่ม “แจ้งปัญหาใหม่” เพื่อเริ่มต้น"
                    href="/service/tickets"
                    hrefLabel="ดูทั้งหมด"
                >
                    {mine.recent.map((t) => (
                        <TicketRow key={t.id} ticket={t} contextLabel="หมวดหมู่" />
                    ))}
                </ListCard>
            </section>
        </div>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

/// ปุ่มสลับช่วงย้อนหลังของ KPI และกราฟ (F9.5) — เป็นลิงก์ เพื่อให้ server คำนวณใหม่
function RangeToggle({ current }: { current: number }) {
    return (
        <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground mr-1">ช่วงข้อมูล</span>
            {[7, 30].map((days) => (
                <Link
                    key={days}
                    href={`/dashboard?range=${days}`}
                    className={
                        days === current
                            ? "bg-primary text-primary-foreground rounded-md px-2.5 py-1 font-medium"
                            : "hover:bg-muted rounded-md px-2.5 py-1"
                    }
                >
                    {days} วัน
                </Link>
            ))}
        </div>
    )
}

/// การ์ดตัวเลขเดียว — `tone` ใช้เน้นเมื่อค่านั้นต้องการการลงมือทำ
function StatCard({
    icon: Icon,
    label,
    value,
    hint,
    href,
    tone,
    valueClass,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    hint?: string
    href?: string
    tone?: "warn" | "danger"
    valueClass?: string
}) {
    const toneClass =
        tone === "danger"
            ? "text-sla-breached"
            : tone === "warn"
              ? "text-sla-atrisk"
              : undefined

    const body = (
        <Card className={href ? "hover:border-primary/40 h-full transition-colors" : "h-full"}>
            <CardContent>
                <div className="flex items-start justify-between gap-2">
                    <p className="text-muted-foreground text-sm">{label}</p>
                    <Icon className={`size-4 shrink-0 ${toneClass ?? "text-muted-foreground"}`} />
                </div>
                <p className={`mt-1 text-2xl font-semibold ${valueClass ?? toneClass ?? ""}`}>
                    {value}
                </p>
                {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
            </CardContent>
        </Card>
    )

    return href ? (
        <Link href={href} className="block">
            {body}
        </Link>
    ) : (
        body
    )
}

/// กรอบรายการที่ใช้ซ้ำทุก widget — เว้นวรรคภายในเป็นหน้าที่ของแถวแต่ละชนิดเอง
function ListCard({
    title,
    hint,
    icon: Icon,
    empty,
    href,
    hrefLabel,
    children,
}: {
    title: string
    hint?: string
    icon: React.ComponentType<{ className?: string }>
    empty: string
    href?: string
    hrefLabel?: string
    children: React.ReactNode
}) {
    const rows = Array.isArray(children) ? children.flat() : [children]
    const isEmpty = rows.filter(Boolean).length === 0

    return (
        <Card className="overflow-hidden py-0">
            <CardHeader className="bg-muted/40 flex flex-row items-center justify-between gap-2 border-b py-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                        <Icon className="text-muted-foreground size-4 shrink-0" />
                        {title}
                    </p>
                    {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
                </div>
                {href && (
                    <Link
                        href={href}
                        className="text-primary flex shrink-0 items-center gap-1 text-xs hover:underline"
                    >
                        {hrefLabel ?? "ดูทั้งหมด"}
                        <ArrowUpRight className="size-3" />
                    </Link>
                )}
            </CardHeader>
            <CardContent className="p-0">
                {isEmpty ? (
                    <p className="text-muted-foreground py-10 text-center text-sm">{empty}</p>
                ) : (
                    <div className="divide-y">{children}</div>
                )}
            </CardContent>
        </Card>
    )
}

function TicketRow({
    ticket,
    contextLabel,
}: {
    ticket: DashboardTicketBrief
    contextLabel: string
}) {
    return (
        <Link
            href={`/service/tickets/${ticket.id}`}
            className="hover:bg-muted/50 block px-4 py-2.5 transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-muted-foreground font-mono text-xs">{ticket.ticketNo}</p>
                    <p className="mt-0.5 truncate text-sm font-medium">{ticket.title}</p>
                    {ticket.context && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            {contextLabel} · {ticket.context}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                </div>
            </div>
            {ticket.resolutionDueAt && (
                <p className="text-muted-foreground mt-1 text-xs">
                    กำหนดแก้ไข {formatThaiDateTime(ticket.resolutionDueAt)}
                </p>
            )}
        </Link>
    )
}

/// แถวของ "งานวันนี้ / งานเลยกำหนด" — รวมทั้ง Ticket, Task และ To-do (F3.9)
function WorkRow({ item, overdue = false }: { item: WorkItem; overdue?: boolean }) {
    const KIND_LABEL: Record<WorkItem["kind"], string> = {
        ticket: "Ticket",
        task: "งานโครงการ",
        todo: "To-do",
    }

    const body = (
        <div className="flex items-start justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
                <p className="text-muted-foreground text-xs">
                    {KIND_LABEL[item.kind]}
                    {item.code && ` · ${item.code}`}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium">{item.title}</p>
                {item.dueDate && (
                    <p
                        className={`mt-0.5 text-xs ${overdue ? "text-sla-breached" : "text-muted-foreground"}`}
                    >
                        กำหนด {formatThaiDateTime(item.dueDate)}
                    </p>
                )}
            </div>
            <PriorityBadge priority={item.priority} className="shrink-0" />
        </div>
    )

    // To-do ไม่มีหน้าของตัวเอง จึงไม่ทำเป็นลิงก์
    return item.href ? (
        <Link href={item.href} className="hover:bg-muted/50 block transition-colors">
            {body}
        </Link>
    ) : (
        body
    )
}
