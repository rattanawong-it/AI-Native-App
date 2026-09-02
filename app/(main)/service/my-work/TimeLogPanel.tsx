"use client"

// แท็บ "บันทึกเวลา" ของหน้า My Work
// อ้างอิง F3.5 (ฟอร์มบันทึก Time Log แบบ Manual) และ F3.7 (สรุปชั่วโมงรายวัน/สัปดาห์/เดือน)
//
// การผูกงาน: เลือกประเภทก่อน แล้วเลือกงานจากรายการที่ดึงมาจากงานของตัวเอง
// ประเภท "งานอื่นๆ" ไม่ต้องผูกกับอะไร ใช้กับงานที่ไม่มีใบสั่งงาน เช่น ประชุม/อบรม

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Pencil, Trash2, Loader2, Timer, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { readError, formatThaiDate } from "@/lib/ticket-types"
import {
    formatHours,
    type MyWorkResponse,
    type WorkItem,
    type WorkLogListResponse,
    type WorkLogRow,
    type WorkLogSummary,
} from "@/lib/worklog-types"

/// ประเภทงานที่ผูกกับบันทึกเวลาได้ — ตรงกับ WORKLOG_REF_TYPES ฝั่ง API
const REF_TYPES = [
    { key: "ticket", label: "Ticket" },
    { key: "task", label: "Task โครงการ" },
    { key: "todo", label: "งานส่วนตัว" },
    { key: "other", label: "งานอื่นๆ" },
] as const

const PERIODS = [
    { key: "day", label: "วันนี้" },
    { key: "week", label: "สัปดาห์นี้" },
    { key: "month", label: "เดือนนี้" },
] as const

type Period = (typeof PERIODS)[number]["key"]

interface FormState {
    id?: string
    workDate: string
    hours: string
    description: string
    refType: string
    refId: string
}

/// วันนี้ตามปฏิทินไทย — ใช้เป็นค่าเริ่มต้นของช่องวันที่
function todayInput(): string {
    return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function emptyForm(): FormState {
    return {
        workDate: todayInput(),
        hours: "",
        description: "",
        refType: "ticket",
        refId: "",
    }
}

export default function TimeLogPanel({ onChanged }: { onChanged: () => void }) {
    const [period, setPeriod] = useState<Period>("week")
    const [summary, setSummary] = useState<WorkLogSummary | null>(null)
    const [logs, setLogs] = useState<WorkLogRow[]>([])
    const [totalHours, setTotalHours] = useState(0)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    /// งานของตัวเองทั้งหมด — ใช้เป็นตัวเลือกในช่อง "ผูกกับงาน"
    const [workItems, setWorkItems] = useState<WorkItem[]>([])

    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState<FormState>(emptyForm())
    const [deleting, setDeleting] = useState<WorkLogRow | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const summaryRes = await fetch(
                `/api/worklogs/summary?period=${period}&scope=own`
            )
            if (!summaryRes.ok) {
                toast.error(await readError(summaryRes, "ไม่สามารถสรุปชั่วโมงทำงานได้"))
                return
            }
            const s = (await summaryRes.json()) as WorkLogSummary
            setSummary(s)

            const listRes = await fetch(
                `/api/worklogs?from=${s.range.from}&to=${s.range.to}&pageSize=100`
            )
            if (!listRes.ok) {
                toast.error(await readError(listRes, "ไม่สามารถโหลดบันทึกเวลาได้"))
                return
            }
            const list = (await listRes.json()) as WorkLogListResponse
            setLogs(list.workLogs)
            setTotalHours(list.totalHours)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [period])

    useEffect(() => {
        void load()
    }, [load])

    // โหลดรายการงานไว้ล่วงหน้าครั้งเดียว — ฟอร์มเปิดแล้วเลือกได้ทันทีไม่ต้องรอ
    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/my-work?kind=all&state=open&limit=200")
                if (res.ok) setWorkItems(((await res.json()) as MyWorkResponse).items)
            } catch {
                // เลือกงานไม่ได้ก็ยังบันทึกแบบ "งานอื่นๆ" ได้ จึงไม่ต้องเตือน
            }
        })()
    }, [])

    /// ตัวเลือกงานที่ตรงกับประเภทที่เลือกอยู่
    const refOptions = useMemo(
        () => workItems.filter((i) => i.kind === form.refType),
        [workItems, form.refType]
    )

    const openCreate = () => {
        setForm(emptyForm())
        setFormOpen(true)
    }

    const openEdit = (log: WorkLogRow) => {
        setForm({
            id: log.id,
            workDate: log.workDate,
            hours: String(log.hours),
            description: log.description,
            refType: log.refType,
            refId: log.ticketId ?? log.taskId ?? log.todoId ?? "",
        })
        setFormOpen(true)
    }

    const save = async () => {
        setBusy(true)
        try {
            const payload = {
                workDate: form.workDate,
                hours: Number(form.hours),
                description: form.description.trim(),
                refType: form.refType,
                ticketId: form.refType === "ticket" ? form.refId || null : null,
                taskId: form.refType === "task" ? form.refId || null : null,
                todoId: form.refType === "todo" ? form.refId || null : null,
            }
            const res = await fetch(form.id ? `/api/worklogs/${form.id}` : "/api/worklogs", {
                method: form.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกเวลาทำงานไม่สำเร็จ"))
                return
            }
            toast.success(form.id ? "แก้ไขบันทึกเวลาเรียบร้อย" : "บันทึกเวลาเรียบร้อย")
            setFormOpen(false)
            await load()
            onChanged()
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
            const res = await fetch(`/api/worklogs/${deleting.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบบันทึกเวลาไม่สำเร็จ"))
                return
            }
            toast.success("ลบบันทึกเวลาเรียบร้อย")
            setDeleting(null)
            await load()
            onChanged()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    /// ความสูงของแท่งในกราฟรายวัน คิดเทียบกับวันที่ทำมากที่สุดในช่วง
    const maxDayHours = useMemo(
        () => Math.max(1, ...(summary?.byDay ?? []).map((d) => d.hours)),
        [summary]
    )

    const formValid =
        form.description.trim().length >= 3 &&
        Number(form.hours) > 0 &&
        (form.refType === "other" || form.refId !== "")

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                <Button onClick={openCreate}>
                    <Plus className="size-4" />
                    บันทึกเวลาทำงาน
                </Button>
            </div>

            {/* สรุปชั่วโมง (F3.7) */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-0">
                        <p className="text-sm font-medium">ชั่วโมงทำงานรายวัน</p>
                        <p className="text-muted-foreground text-xs">
                            {summary
                                ? `${formatThaiDate(summary.range.from)} – ${formatThaiDate(summary.range.to)}`
                                : "กำลังโหลด..."}
                        </p>
                    </CardHeader>
                    <CardContent>
                        {loading || !summary ? (
                            <Skeleton className="h-28 w-full" />
                        ) : summary.totalEntries === 0 ? (
                            <p className="text-muted-foreground py-8 text-center text-sm">
                                ยังไม่มีบันทึกเวลาในช่วงนี้
                            </p>
                        ) : (
                            <div className="flex h-28 items-end gap-1.5 overflow-x-auto">
                                {summary.byDay.map((d) => (
                                    <div
                                        key={d.key}
                                        className="flex min-w-[28px] flex-1 flex-col items-center gap-1"
                                        title={`${d.label} · ${formatHours(d.hours)}`}
                                    >
                                        <div
                                            className={
                                                d.hours > 0
                                                    ? "bg-brand w-full rounded-t"
                                                    : "bg-muted w-full rounded-t"
                                            }
                                            style={{
                                                height: `${Math.max(2, (d.hours / maxDayHours) * 88)}px`,
                                            }}
                                        />
                                        <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                                            {d.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-0">
                        <p className="text-sm font-medium">สรุปช่วงนี้</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loading || !summary ? (
                            <Skeleton className="h-28 w-full" />
                        ) : (
                            <>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-semibold">
                                        {summary.totalHours}
                                    </span>
                                    <span className="text-muted-foreground text-sm">
                                        ชั่วโมง · {summary.totalEntries} รายการ ·{" "}
                                        {summary.daysLogged} วันที่ลงเวลา
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {summary.byRefType.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">
                                            ยังไม่มีข้อมูลแยกตามประเภทงาน
                                        </p>
                                    ) : (
                                        summary.byRefType.map((r) => (
                                            <div
                                                key={r.key}
                                                className="flex items-center justify-between text-sm"
                                            >
                                                <span className="text-muted-foreground">
                                                    {r.label}
                                                </span>
                                                <span className="font-medium">
                                                    {formatHours(r.hours)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* รายการบันทึกเวลา */}
            <Card className="overflow-hidden py-0">
                <CardContent className="p-0">
                    <div className="text-muted-foreground bg-muted/50 flex items-center justify-between px-6 py-3 text-xs font-medium">
                        <span>บันทึกเวลาในช่วงที่เลือก</span>
                        <span>รวม {formatHours(totalHours)}</span>
                    </div>
                    {loading ? (
                        <div className="space-y-3 p-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-muted-foreground p-12 text-center text-sm">
                            <Timer className="mx-auto mb-3 size-8 opacity-40" />
                            ยังไม่มีบันทึกเวลาในช่วงนี้
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div
                                key={log.id}
                                className={
                                    "flex items-start gap-4 px-6 py-3.5" + (i > 0 ? " border-t" : "")
                                }
                            >
                                <div className="w-24 shrink-0">
                                    <p className="text-sm font-medium">{formatHours(log.hours)}</p>
                                    <p className="text-muted-foreground text-xs">
                                        {formatThaiDate(log.workDate)}
                                    </p>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm">{log.description}</p>
                                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                                        <span>{log.refLabel}</span>
                                        {log.refTitle && (
                                            <>
                                                <span>·</span>
                                                {log.refHref ? (
                                                    <Link
                                                        href={log.refHref}
                                                        className="hover:text-foreground inline-flex items-center gap-1 truncate underline-offset-2 hover:underline"
                                                    >
                                                        {log.refTitle}
                                                        <ExternalLink className="size-3" />
                                                    </Link>
                                                ) : (
                                                    <span className="truncate">{log.refTitle}</span>
                                                )}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(log)}>
                                        <Pencil className="size-4" />
                                        <span className="sr-only">แก้ไข</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleting(log)}
                                    >
                                        <Trash2 className="text-destructive size-4" />
                                        <span className="sr-only">ลบ</span>
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* ฟอร์มบันทึกเวลา (F3.5) */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {form.id ? "แก้ไขบันทึกเวลา" : "บันทึกเวลาทำงาน"}
                        </DialogTitle>
                        <DialogDescription>
                            กรอกวันที่ทำงาน จำนวนชั่วโมง และสิ่งที่ทำ พร้อมผูกกับงานที่เกี่ยวข้อง
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">วันที่ทำงาน</Label>
                                <Input
                                    type="date"
                                    value={form.workDate}
                                    onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">จำนวนชั่วโมง</Label>
                                <Input
                                    type="number"
                                    min={0.25}
                                    max={24}
                                    step={0.25}
                                    value={form.hours}
                                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                                    placeholder="เช่น 1.5"
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">ประเภทงาน</Label>
                                <select
                                    value={form.refType}
                                    onChange={(e) =>
                                        // เปลี่ยนประเภทแล้วต้องล้างงานที่เลือกไว้ ไม่งั้นจะผูกผิดตาราง
                                        setForm({ ...form, refType: e.target.value, refId: "" })
                                    }
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    {REF_TYPES.map((r) => (
                                        <option key={r.key} value={r.key}>
                                            {r.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="mb-1.5">
                                    {form.refType === "other" ? "ไม่ต้องผูกกับงาน" : "ผูกกับงาน"}
                                </Label>
                                <select
                                    value={form.refId}
                                    disabled={form.refType === "other"}
                                    onChange={(e) => setForm({ ...form, refId: e.target.value })}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                                >
                                    <option value="">
                                        {refOptions.length === 0
                                            ? "ไม่มีงานค้างในประเภทนี้"
                                            : "-- เลือกงาน --"}
                                    </option>
                                    {refOptions.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {[o.code, o.title].filter(Boolean).join(" · ")}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <Label className="mb-1.5">สิ่งที่ทำ</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) =>
                                    setForm({ ...form, description: e.target.value })
                                }
                                rows={4}
                                placeholder="อธิบายสิ่งที่ทำในช่วงเวลานี้..."
                            />
                        </div>

                        {form.id && form.refType !== "other" && form.refId === "" && (
                            <p className="text-sla-breached text-xs">
                                บันทึกนี้เคยผูกกับงานที่ไม่อยู่ในรายการงานค้างแล้ว
                                กรุณาเลือกงานใหม่หรือเปลี่ยนประเภทเป็น &ldquo;งานอื่นๆ&rdquo;
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => void save()} disabled={busy || !formValid}>
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
                        <AlertDialogTitle>ลบบันทึกเวลานี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting
                                ? `${formatThaiDate(deleting.workDate)} · ${formatHours(deleting.hours)} — ${deleting.description}`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove()} disabled={busy}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            ลบ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
