"use client"

// หน้ารายละเอียด Ticket — timeline, ความคิดเห็น, เปลี่ยนสถานะ, มอบหมาย, ปรับความสำคัญ
// อ้างอิง F1.5, F1.6, F2.3, F2.4, F2.6, F2.8, F4.8, F4.9

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    ChevronLeft,
    Clock,
    Flag,
    Loader2,
    Lock,
    MessageSquare,
    Send,
    Ticket as TicketIcon,
    UserCog,
    CheckCircle2,
    History,
    RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    PriorityBadge,
    StatusBadge,
    SlaProgressBar,
    PersonChip,
    ImpactUrgencyText,
    ChannelLabel,
} from "@/components/ticket/ticket-badges"
import {
    calculatePriority,
    IMPACT_LABEL,
    URGENCY_LABEL,
    type Impact,
    type Urgency,
} from "@/lib/priority"
import {
    nextStatuses,
    TICKET_STATUS_LABEL,
    TICKET_ACTION_LABEL,
    type TicketAction,
} from "@/lib/ticket-workflow"
import {
    formatThaiDateTime,
    formatRelative,
    readError,
    type DirectoryAgent,
    type DirectoryTeam,
    type TicketDetailResponse,
} from "@/lib/ticket-types"

const LEVELS_ASC = ["low", "medium", "high"] as const

export default function TicketDetailContent({ ticketId }: { ticketId: string }) {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isStaff = roles.some((r) => ["agent", "manager", "admin"].includes(r))
    const isManager = roles.some((r) => ["manager", "admin"].includes(r))

    const [data, setData] = useState<TicketDetailResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    // ความคิดเห็น (F1.6)
    const [comment, setComment] = useState("")
    const [isInternal, setIsInternal] = useState(false)

    // กล่องโต้ตอบ
    const [assignOpen, setAssignOpen] = useState(false)
    const [priorityOpen, setPriorityOpen] = useState(false)
    const [resolveOpen, setResolveOpen] = useState(false)

    /// F3.6 — ระบบบังคับให้กรอกชั่วโมงก่อนปิดงานหรือไม่ (ตั้งค่าที่หน้า admin/sla)
    /// ค่าเริ่มต้นเป็น true ให้ตรงกับฝั่ง API เผื่ออ่านค่าไม่สำเร็จ จะได้ไม่ปล่อยผ่านโดยไม่รู้ตัว
    const [requireWorkLog, setRequireWorkLog] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่พบ Ticket ที่ต้องการ"))
                return
            }
            setData((await res.json()) as TicketDetailResponse)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [ticketId])

    useEffect(() => {
        void load()
    }, [load])

    // อ่านกฎการปิดงานครั้งเดียวตอนเปิดหน้า — ใช้บอก dialog ว่าช่องชั่วโมงบังคับหรือไม่ (F3.6)
    useEffect(() => {
        if (!isStaff) return
        void (async () => {
            try {
                const res = await fetch("/api/settings")
                if (!res.ok) return
                const data = (await res.json()) as {
                    settings: { key: string; value: boolean }[]
                }
                const hit = data.settings.find(
                    (s) => s.key === "ticket.require_worklog_on_resolve"
                )
                if (hit) setRequireWorkLog(hit.value)
            } catch {
                // อ่านไม่ได้ก็คงค่า true ไว้ — ฝั่ง API เป็นผู้ตัดสินจริงอยู่แล้ว
            }
        })()
    }, [isStaff])

    /// เปลี่ยนสถานะ (F2.6) — resolved จัดการแยกผ่าน dialog เพราะต้องกรอกสรุปการแก้ไข
    const changeStatus = async (status: string, extra?: Record<string, unknown>) => {
        setBusy(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, ...extra }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถเปลี่ยนสถานะได้"))
                return false
            }
            toast.success(`เปลี่ยนสถานะเป็น "${TICKET_STATUS_LABEL[status as keyof typeof TICKET_STATUS_LABEL]}" แล้ว`)
            await load()
            return true
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
            return false
        } finally {
            setBusy(false)
        }
    }

    const submitComment = async () => {
        if (comment.trim().length === 0) return
        setBusy(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: comment.trim(), isInternal }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกความคิดเห็นได้"))
                return
            }
            setComment("")
            setIsInternal(false)
            await load()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    if (loading && !data) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="py-16 text-center">
                <TicketIcon className="text-muted-foreground mx-auto mb-3 size-10 opacity-40" />
                <p className="text-muted-foreground">ไม่พบ Ticket ที่ต้องการ</p>
                <Button variant="outline" className="mt-4" asChild>
                    <Link href="/service/tickets">กลับไป Ticket ทั้งหมด</Link>
                </Button>
            </div>
        )
    }

    const { ticket, comments, activities, can } = data
    // ปิดงานแล้วแก้อะไรไม่ได้อีก — ซ่อนปุ่มดำเนินการทั้งหมด (API ก็ปฏิเสธอยู่แล้ว)
    const canAct = isStaff && can.update && ticket.status !== "closed"
    const transitions = nextStatuses(ticket.status)

    return (
        <div className="space-y-6">
            <Link
                href="/service/tickets"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
                <ChevronLeft className="size-4" />
                กลับไป Ticket ทั้งหมด
            </Link>

            {/* หัวข้อ + ปุ่มดำเนินการ */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        <span className="font-mono">{ticket.ticketNo}</span> · แจ้งเมื่อ{" "}
                        {formatThaiDateTime(ticket.createdAt)} · ช่องทาง{" "}
                        <ChannelLabel channel={ticket.channel} />
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="icon" onClick={() => void load()} disabled={busy}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>

                    {canAct && (
                        <>
                            <Button variant="outline" onClick={() => setAssignOpen(true)}>
                                <UserCog className="size-4" />
                                มอบหมาย
                            </Button>
                            <Button variant="outline" onClick={() => setPriorityOpen(true)}>
                                <Flag className="size-4" />
                                ปรับความสำคัญ
                            </Button>
                        </>
                    )}

                    {/* ปุ่มเปลี่ยนสถานะตามเส้นทางที่อนุญาต (F2.6) */}
                    {canAct &&
                        transitions.map((s) =>
                            s === "resolved" ? (
                                <Button key={s} onClick={() => setResolveOpen(true)} disabled={busy}>
                                    <CheckCircle2 className="size-4" />
                                    แก้ไขเสร็จสิ้น
                                </Button>
                            ) : (
                                <Button
                                    key={s}
                                    variant={s === "closed" ? "default" : "outline"}
                                    onClick={() => void changeStatus(s)}
                                    disabled={busy}
                                >
                                    {s === "in_progress" && <Clock className="size-4" />}
                                    {s === "closed" && <CheckCircle2 className="size-4" />}
                                    {s === "in_progress" && ticket.status === "resolved"
                                        ? "เปิดงานอีกครั้ง"
                                        : TICKET_STATUS_LABEL[s]}
                                </Button>
                            )
                        )}
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {/* คอลัมน์ซ้าย */}
                <div className="min-w-0 space-y-4">
                    <Card>
                        <CardHeader>
                            <h2 className="font-medium">รายละเอียดปัญหา</h2>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm leading-7 whitespace-pre-wrap">
                                {ticket.description}
                            </p>
                        </CardContent>
                    </Card>

                    {ticket.resolutionNote && (
                        <Card>
                            <CardHeader>
                                <h2 className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="text-sla-ontime size-4" />
                                    สรุปการแก้ไข
                                </h2>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm leading-7 whitespace-pre-wrap">
                                    {ticket.resolutionNote}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* ความคิดเห็น (F1.6) */}
                    <Card>
                        <CardHeader>
                            <h2 className="flex items-center gap-2 font-medium">
                                <MessageSquare className="size-4" />
                                ความคิดเห็น ({comments.length})
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {comments.length === 0 ? (
                                <p className="text-muted-foreground text-sm">ยังไม่มีความคิดเห็น</p>
                            ) : (
                                comments.map((c) => (
                                    <div key={c.id} className="flex gap-3">
                                        <PersonChip person={c.author} size={32} avatarOnly className="shrink-0" />
                                        <div
                                            className={
                                                c.isInternal
                                                    ? "bg-gold-bg min-w-0 flex-1 rounded-lg px-4 py-3"
                                                    : "bg-accent min-w-0 flex-1 rounded-lg px-4 py-3"
                                            }
                                        >
                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium">{c.author.name}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {formatRelative(c.createdAt)}
                                                </span>
                                                {c.isInternal && (
                                                    <span className="text-gold-fg inline-flex items-center gap-1 text-xs font-medium">
                                                        <Lock className="size-3" />
                                                        บันทึกภายใน
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground text-sm leading-6 whitespace-pre-wrap">
                                                {c.body}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}

                            {ticket.status !== "closed" && (
                                <div className="space-y-2 border-t pt-4">
                                    <Textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="เขียนความคิดเห็น..."
                                        rows={3}
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        {can.internalNote ? (
                                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={isInternal}
                                                    onChange={(e) => setIsInternal(e.target.checked)}
                                                    className="size-4"
                                                />
                                                <Lock className="text-muted-foreground size-3.5" />
                                                บันทึกภายใน (ผู้แจ้งจะไม่เห็นข้อความนี้)
                                            </label>
                                        ) : (
                                            <span />
                                        )}
                                        <Button
                                            onClick={() => void submitComment()}
                                            disabled={busy || comment.trim().length === 0}
                                        >
                                            {busy ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Send className="size-4" />
                                            )}
                                            ส่ง
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline (F1.5) */}
                    <Card>
                        <CardHeader>
                            <h2 className="flex items-center gap-2 font-medium">
                                <History className="size-4" />
                                ประวัติการดำเนินงาน
                            </h2>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-0">
                                {activities.map((a, i) => (
                                    <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                                        {i < activities.length - 1 && (
                                            <span className="bg-border absolute top-8 bottom-0 left-[13px] w-px" />
                                        )}
                                        <span className="bg-accent z-10 flex size-7 shrink-0 items-center justify-center rounded-full border">
                                            <TicketIcon className="text-muted-foreground size-3.5" />
                                        </span>
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <p className="text-sm">
                                                <span className="font-medium">{a.actor.name}</span>{" "}
                                                {TICKET_ACTION_LABEL[a.action as TicketAction] ?? a.action}
                                                {a.fromValue && a.toValue ? (
                                                    <>
                                                        {" "}
                                                        จาก <span className="font-medium">{a.fromValue}</span> เป็น{" "}
                                                        <span className="font-medium">{a.toValue}</span>
                                                    </>
                                                ) : a.toValue ? (
                                                    <>
                                                        {" "}
                                                        → <span className="font-medium">{a.toValue}</span>
                                                    </>
                                                ) : null}
                                            </p>
                                            {a.note && (
                                                <p className="text-muted-foreground mt-0.5 text-sm">{a.note}</p>
                                            )}
                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                {formatThaiDateTime(a.createdAt)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>
                </div>

                {/* คอลัมน์ขวา */}
                <div className="min-w-0 space-y-4">
                    <Card>
                        <CardContent className="space-y-4">
                            <Meta label="สถานะ">
                                <StatusBadge status={ticket.status} />
                            </Meta>
                            <Meta label="ระดับความสำคัญ">
                                <PriorityBadge priority={ticket.priority} />
                                <p className="text-muted-foreground mt-2 text-xs">
                                    <ImpactUrgencyText impact={ticket.impact} urgency={ticket.urgency} />
                                </p>
                            </Meta>
                            <Meta
                                label={
                                    ticket.sla?.target === "response"
                                        ? "SLA — เวลาตอบกลับ"
                                        : "SLA — เวลาแก้ไข"
                                }
                            >
                                {ticket.sla?.target === "done" ? (
                                    <p className="text-muted-foreground text-sm">
                                        {ticket.resolutionBreached ? "ปิดงานเกินกำหนด" : "ปิดงานตรงเวลา"}
                                    </p>
                                ) : (
                                    <SlaProgressBar sla={ticket.sla} />
                                )}
                                <dl className="text-muted-foreground mt-3 space-y-1 text-xs">
                                    <div className="flex justify-between gap-2">
                                        <dt>กำหนดตอบกลับ</dt>
                                        <dd>{formatThaiDateTime(ticket.responseDueAt)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <dt>กำหนดแก้ไข</dt>
                                        <dd>{formatThaiDateTime(ticket.resolutionDueAt)}</dd>
                                    </div>
                                    {ticket.respondedAt && (
                                        <div className="flex justify-between gap-2">
                                            <dt>ตอบกลับเมื่อ</dt>
                                            <dd>{formatThaiDateTime(ticket.respondedAt)}</dd>
                                        </div>
                                    )}
                                    {ticket.resolvedAt && (
                                        <div className="flex justify-between gap-2">
                                            <dt>แก้ไขเสร็จเมื่อ</dt>
                                            <dd>{formatThaiDateTime(ticket.resolvedAt)}</dd>
                                        </div>
                                    )}
                                </dl>
                            </Meta>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4">
                            <Meta label="ผู้รับผิดชอบ">
                                <PersonChip person={ticket.assignee} size={32} />
                            </Meta>
                            <Meta label="ทีมที่ดูแล">
                                <p className="text-sm">{ticket.team?.name ?? "—"}</p>
                            </Meta>
                            <Meta label="ผู้แจ้ง">
                                <PersonChip person={ticket.requester} size={32} />
                            </Meta>
                            <Meta label="หน่วยงาน">
                                <p className="text-sm">{ticket.department?.name ?? "—"}</p>
                            </Meta>
                            <Meta label="หมวดหมู่บริการ">
                                <p className="text-sm">{ticket.category.name}</p>
                            </Meta>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* กล่องโต้ตอบ */}
            <AssignDialog
                key={`assign-${assignOpen}`}
                open={assignOpen}
                onOpenChange={setAssignOpen}
                ticketId={ticketId}
                currentAssigneeId={ticket.assigneeId}
                currentTeamId={ticket.teamId}
                canAssignOthers={isManager}
                myId={session?.user?.id ?? ""}
                onDone={load}
            />
            <PriorityDialog
                key={`priority-${priorityOpen}`}
                open={priorityOpen}
                onOpenChange={setPriorityOpen}
                ticketId={ticketId}
                currentImpact={ticket.impact as Impact}
                currentUrgency={ticket.urgency as Urgency}
                onDone={load}
            />
            <ResolveDialog
                key={`resolve-${resolveOpen}`}
                open={resolveOpen}
                onOpenChange={setResolveOpen}
                busy={busy}
                requireWorkLog={requireWorkLog}
                onSubmit={async (resolutionNote, workHours) => {
                    const ok = await changeStatus("resolved", { resolutionNote, workHours })
                    if (ok) setResolveOpen(false)
                }}
            />
        </div>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">{label}</p>
            {children}
        </div>
    )
}

/// F2.8 — มอบหมาย / โยกย้ายงาน
function AssignDialog({
    open,
    onOpenChange,
    ticketId,
    currentAssigneeId,
    currentTeamId,
    canAssignOthers,
    myId,
    onDone,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    ticketId: string
    currentAssigneeId: string | null
    currentTeamId: string | null
    canAssignOthers: boolean
    myId: string
    onDone: () => Promise<void>
}) {
    const [agents, setAgents] = useState<DirectoryAgent[]>([])
    const [teams, setTeams] = useState<DirectoryTeam[]>([])
    const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "")
    const [teamId, setTeamId] = useState(currentTeamId ?? "")
    const [note, setNote] = useState("")
    const [busy, setBusy] = useState(false)

    // ดึงรายชื่อเมื่อกล่องเปิด — ค่าเริ่มต้นของฟอร์มมาจาก useState เพราะ parent
    // สั่ง remount ด้วย key ทุกครั้งที่เปิด/ปิด จึงไม่ต้อง reset ใน effect
    useEffect(() => {
        if (!open) return
        void (async () => {
            const res = await fetch("/api/directory")
            if (res.ok) {
                const d = (await res.json()) as { agents: DirectoryAgent[]; teams: DirectoryTeam[] }
                setAgents(d.agents)
                setTeams(d.teams)
            }
        })()
    }, [open])

    const submit = async () => {
        setBusy(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}/assign`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assigneeId: assigneeId || null,
                    teamId: teamId || null,
                    note: note.trim() || undefined,
                }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถมอบหมายงานได้"))
                return
            }
            toast.success("บันทึกการมอบหมายเรียบร้อย")
            onOpenChange(false)
            setNote("")
            await onDone()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const options = canAssignOthers ? agents : agents.filter((a) => a.id === myId)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>มอบหมายงาน</DialogTitle>
                    <DialogDescription>
                        {canAssignOthers
                            ? "เลือกเจ้าหน้าที่และทีมที่รับผิดชอบ Ticket ใบนี้"
                            : "เจ้าหน้าที่มอบหมายงานให้ตัวเองได้ — การโยกให้ผู้อื่นเป็นสิทธิ์ของหัวหน้า"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label className="mb-1.5">ผู้รับผิดชอบ</Label>
                        <select
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">— ยังไม่มอบหมาย —</option>
                            {options.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                    {a.position ? ` · ${a.position}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <Label className="mb-1.5">ทีมที่ดูแล</Label>
                        <select
                            value={teamId}
                            onChange={(e) => setTeamId(e.target.value)}
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">— ไม่ระบุทีม —</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <Label className="mb-1.5">เหตุผล / บันทึกเพิ่มเติม</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="เช่น โยกให้ทีมเครือข่ายดูแลต่อ"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        ยกเลิก
                    </Button>
                    <Button onClick={() => void submit()} disabled={busy}>
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        บันทึก
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/// F2.4 — ปรับ Impact × Urgency แล้วคำนวณ priority + กำหนดเวลาใหม่ พร้อมบันทึกเหตุผล
function PriorityDialog({
    open,
    onOpenChange,
    ticketId,
    currentImpact,
    currentUrgency,
    onDone,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    ticketId: string
    currentImpact: Impact
    currentUrgency: Urgency
    onDone: () => Promise<void>
}) {
    const [impact, setImpact] = useState<Impact>(currentImpact)
    const [urgency, setUrgency] = useState<Urgency>(currentUrgency)
    const [reason, setReason] = useState("")
    const [busy, setBusy] = useState(false)

    const priority = calculatePriority(impact, urgency)
    const changed = impact !== currentImpact || urgency !== currentUrgency

    const submit = async () => {
        if (!changed) return onOpenChange(false)
        setBusy(true)
        try {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ impact, urgency, reason: reason.trim() || undefined }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถปรับระดับความสำคัญได้"))
                return
            }
            toast.success("ปรับระดับความสำคัญและคำนวณกำหนดเวลาใหม่แล้ว")
            onOpenChange(false)
            await onDone()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>ปรับระดับความสำคัญ</DialogTitle>
                    <DialogDescription>
                        เปลี่ยน Impact หรือ Urgency แล้วระบบจะคำนวณ Priority และกำหนดเวลาตาม SLA ใหม่ทั้งหมด
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <LevelRow
                        label="ผลกระทบ (Impact)"
                        value={impact}
                        onChange={(v) => setImpact(v as Impact)}
                        labels={IMPACT_LABEL}
                    />
                    <LevelRow
                        label="ความเร่งด่วน (Urgency)"
                        value={urgency}
                        onChange={(v) => setUrgency(v as Urgency)}
                        labels={URGENCY_LABEL}
                    />

                    <div className="bg-accent flex items-center gap-3 rounded-lg px-4 py-3">
                        <Flag className="text-muted-foreground size-4" />
                        <span className="text-muted-foreground text-sm">ระดับใหม่ที่คำนวณได้</span>
                        <PriorityBadge priority={priority} />
                    </div>

                    <div>
                        <Label className="mb-1.5">เหตุผลที่ปรับ</Label>
                        <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="เช่น กระทบผู้ใช้ทั้งคณะ ต้องเร่งแก้"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        ยกเลิก
                    </Button>
                    <Button onClick={() => void submit()} disabled={busy || !changed}>
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        บันทึก
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/// F2.6 — ปิดงานต้องกรอกสรุปการแก้ไข · F3.6 — ชั่วโมงทำงานบังคับเมื่อเปิดกฎไว้
function ResolveDialog({
    open,
    onOpenChange,
    busy,
    requireWorkLog,
    onSubmit,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    busy: boolean
    /// true = ต้องกรอกชั่วโมงก่อนจึงจะกดปิดงานได้ (AppSetting ticket.require_worklog_on_resolve)
    requireWorkLog: boolean
    onSubmit: (resolutionNote: string, workHours?: number) => Promise<void>
}) {
    const [note, setNote] = useState("")
    const [hours, setHours] = useState("")

    const hoursValue = Number(hours)
    const hoursOk = !requireWorkLog || (hours !== "" && hoursValue > 0 && hoursValue <= 24)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>บันทึกการแก้ไขเสร็จสิ้น</DialogTitle>
                    <DialogDescription>
                        สรุปวิธีการแก้ไขเพื่อเก็บเป็นองค์ความรู้ และบันทึกชั่วโมงที่ใช้ทำงาน
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label className="mb-1.5">สรุปการแก้ไข</Label>
                        <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="อธิบายสาเหตุที่พบและวิธีที่ใช้แก้ไข..."
                            rows={5}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5">
                            ชั่วโมงที่ใช้ {requireWorkLog ? "" : "(ไม่บังคับ)"}
                        </Label>
                        <Input
                            type="number"
                            min={0}
                            max={24}
                            step={0.25}
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            placeholder="เช่น 1.5"
                            className="w-32"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            {requireWorkLog
                                ? "ระบบกำหนดให้บันทึกชั่วโมงที่ใช้ทำงานก่อนปิดงาน (บันทึกเป็น Time Log ผูกกับ Ticket ใบนี้)"
                                : "บันทึกเป็น Time Log ผูกกับ Ticket ใบนี้"}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        ยกเลิก
                    </Button>
                    <Button
                        onClick={() =>
                            void onSubmit(note.trim(), hours ? Number(hours) : undefined)
                        }
                        disabled={busy || note.trim().length < 5 || !hoursOk}
                    >
                        {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="size-4" />
                        )}
                        บันทึกและปิดงาน
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LevelRow({
    label,
    value,
    onChange,
    labels,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    labels: Record<string, string>
}) {
    return (
        <div>
            <Label className="mb-1.5">{label}</Label>
            <div className="flex gap-2">
                {LEVELS_ASC.map((level) => (
                    <button
                        key={level}
                        type="button"
                        onClick={() => onChange(level)}
                        className={
                            value === level
                                ? "bg-primary text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm font-semibold"
                                : "border-input bg-card hover:bg-accent flex-1 rounded-md border px-3 py-2 text-sm"
                        }
                    >
                        {labels[level]}
                    </button>
                ))}
            </div>
        </div>
    )
}
