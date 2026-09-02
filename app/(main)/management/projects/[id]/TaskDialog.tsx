"use client"

// กล่องรายละเอียดงาน — สร้าง / แก้ไข / ลบ / แสดงความเห็น
// อ้างอิง F5.6 (CRUD Task), F5.7 (detail modal + comment) และ F5.9 (ลิงก์กลับไป Ticket ต้นทาง)
//
// ใช้กล่องเดียวทั้งตอนสร้างและตอนแก้ เพราะฟิลด์ชุดเดียวกัน — ต่างกันแค่ตอนแก้จะโหลด
// รายละเอียดกับความเห็นเพิ่ม และมีปุ่มลบ

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Trash2, Ticket as TicketIcon, Send, MessageSquare } from "lucide-react"
import { toast } from "sonner"
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
import { PersonChip } from "@/components/ticket/ticket-badges"
import { BOARD_STATUSES, BOARD_STATUS_LABEL, type BoardStatus } from "@/lib/task-board"
import { PRIORITY_LEVELS, PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { formatRelative, readError, type Person } from "@/lib/ticket-types"
import {
    toDateInput,
    type SprintRow,
    type TaskComment,
    type TaskDetail,
    type TaskDetailResponse,
} from "@/lib/project-types"

export interface TaskDialogTarget {
    /// มี id = เปิดงานที่มีอยู่ · ไม่มี = สร้างงานใหม่ด้วยค่าตั้งต้นด้านล่าง
    id?: string
    boardStatus?: BoardStatus
    sprintId?: string | null
}

interface Props {
    projectId: string
    target: TaskDialogTarget | null
    onClose: () => void
    /// เรียกเมื่อมีการบันทึก/ลบสำเร็จ เพื่อให้หน้ากระดานโหลดข้อมูลใหม่
    onSaved: () => void
    sprints: SprintRow[]
    agents: Person[]
    canManage: boolean
    currentUserId: string | null
}

interface FormState {
    title: string
    description: string
    boardStatus: BoardStatus
    priority: Priority
    assigneeId: string
    sprintId: string
    estimateHours: string
    dueDate: string
}

const EMPTY_FORM: FormState = {
    title: "",
    description: "",
    boardStatus: "backlog",
    priority: "medium",
    assigneeId: "",
    sprintId: "",
    estimateHours: "",
    dueDate: "",
}

export default function TaskDialog({
    projectId,
    target,
    onClose,
    onSaved,
    sprints,
    agents,
    canManage,
    currentUserId,
}: Props) {
    const isEdit = Boolean(target?.id)

    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [detail, setDetail] = useState<TaskDetail | null>(null)
    const [comments, setComments] = useState<TaskComment[]>([])
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [commentBody, setCommentBody] = useState("")

    /// เจ้าหน้าที่แก้ได้เฉพาะงานที่ตัวเองถือ — ตรงกับกติกาฝั่ง API (spec §7)
    const canEdit = canManage || (detail !== null && detail.assigneeId === currentUserId)

    const load = useCallback(async () => {
        if (!target?.id) {
            setDetail(null)
            setComments([])
            setForm({
                ...EMPTY_FORM,
                boardStatus: target?.boardStatus ?? "backlog",
                sprintId: target?.sprintId ?? "",
            })
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`/api/tasks/${target.id}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายละเอียดงานได้"))
                onClose()
                return
            }
            const data = (await res.json()) as TaskDetailResponse
            setDetail(data.task)
            setComments(data.comments)
            setForm({
                title: data.task.title,
                description: data.task.description ?? "",
                boardStatus: data.task.boardStatus as BoardStatus,
                priority: data.task.priority as Priority,
                assigneeId: data.task.assigneeId ?? "",
                sprintId: data.task.sprintId ?? "",
                estimateHours:
                    data.task.estimateHours !== null ? String(data.task.estimateHours) : "",
                dueDate: toDateInput(data.task.dueDate),
            })
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
            onClose()
        } finally {
            setLoading(false)
        }
        // onClose เปลี่ยนทุก render ของ parent จึงไม่ใส่ใน deps — สนใจเฉพาะการเปลี่ยนงานที่เปิดอยู่
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target?.id, target?.boardStatus, target?.sprintId])

    useEffect(() => {
        if (target) void load()
    }, [target, load])

    const save = async () => {
        setBusy(true)
        try {
            const payload = {
                ...(isEdit ? {} : { projectId }),
                title: form.title,
                description: form.description.trim() || null,
                boardStatus: form.boardStatus,
                priority: form.priority,
                assigneeId: form.assigneeId || null,
                sprintId: form.sprintId || null,
                estimateHours: form.estimateHours.trim() || null,
                dueDate: form.dueDate || null,
            }
            const res = await fetch(isEdit ? `/api/tasks/${target?.id}` : "/api/tasks", {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกงานไม่สำเร็จ"))
                return
            }
            toast.success(isEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มงานเรียบร้อย")
            onSaved()
            onClose()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        if (!target?.id) return
        setBusy(true)
        try {
            const res = await fetch(`/api/tasks/${target.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบงานไม่สำเร็จ"))
                return
            }
            toast.success("ลบงานแล้ว")
            onSaved()
            onClose()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
            setConfirmDelete(false)
        }
    }

    const sendComment = async () => {
        if (!target?.id || commentBody.trim().length === 0) return
        setBusy(true)
        try {
            const res = await fetch(`/api/tasks/${target.id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: commentBody }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ส่งความคิดเห็นไม่สำเร็จ"))
                return
            }
            const data = (await res.json()) as { comment: TaskComment }
            setComments((prev) => [...prev, data.comment])
            setCommentBody("")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={target !== null} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "รายละเอียดงาน" : "เพิ่มงานใหม่"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "แก้ไขรายละเอียด ย้ายคอลัมน์ หรือพูดคุยกันในงานนี้"
                            : "งานที่เพิ่มใหม่จะไปอยู่ในคอลัมน์ที่เลือก และเข้ารอบพัฒนาที่กำลังดูอยู่"}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* มาจาก Ticket ใบไหน (F5.9) */}
                        {detail?.sourceTicket && (
                            <div className="bg-brand-tint/60 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
                                <TicketIcon className="text-brand size-4" />
                                <span className="text-muted-foreground">มาจาก</span>
                                <Link
                                    href={`/service/tickets/${detail.sourceTicket.id}`}
                                    className="text-brand font-medium hover:underline"
                                >
                                    {detail.sourceTicket.ticketNo} · {detail.sourceTicket.title}
                                </Link>
                            </div>
                        )}

                        <div>
                            <Label className="mb-1.5">หัวข้องาน</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="เช่น ทำหน้ารายงาน SLA รายเดือน"
                                disabled={isEdit && !canEdit}
                            />
                        </div>

                        <div>
                            <Label className="mb-1.5">รายละเอียด (ไม่บังคับ)</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={4}
                                placeholder="สิ่งที่ต้องทำ เงื่อนไขการตรวจรับ..."
                                disabled={isEdit && !canEdit}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">คอลัมน์</Label>
                                <select
                                    value={form.boardStatus}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            boardStatus: e.target.value as BoardStatus,
                                        })
                                    }
                                    disabled={isEdit && !canEdit}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                                >
                                    {BOARD_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {BOARD_STATUS_LABEL[s]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="mb-1.5">ระดับความสำคัญ</Label>
                                <select
                                    value={form.priority}
                                    onChange={(e) =>
                                        setForm({ ...form, priority: e.target.value as Priority })
                                    }
                                    disabled={isEdit && !canEdit}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                                >
                                    {PRIORITY_LEVELS.map((p) => (
                                        <option key={p} value={p}>
                                            {PRIORITY_LABEL[p]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">ผู้รับผิดชอบ</Label>
                                <select
                                    value={form.assigneeId}
                                    onChange={(e) =>
                                        setForm({ ...form, assigneeId: e.target.value })
                                    }
                                    disabled={!canManage}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                                >
                                    <option value="">ยังไม่มอบหมาย</option>
                                    {agents.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="mb-1.5">รอบพัฒนา</Label>
                                <select
                                    value={form.sprintId}
                                    onChange={(e) => setForm({ ...form, sprintId: e.target.value })}
                                    disabled={isEdit && !canEdit}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                                >
                                    <option value="">Backlog (ยังไม่เข้ารอบ)</option>
                                    {sprints.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">ชั่วโมงที่ประมาณ (ไม่บังคับ)</Label>
                                <Input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    value={form.estimateHours}
                                    onChange={(e) =>
                                        setForm({ ...form, estimateHours: e.target.value })
                                    }
                                    placeholder="8"
                                    disabled={isEdit && !canEdit}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">กำหนดส่ง (ไม่บังคับ)</Label>
                                <Input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                    disabled={isEdit && !canEdit}
                                />
                            </div>
                        </div>

                        {/* ความเห็น (F5.7) */}
                        {isEdit && (
                            <div className="space-y-3 border-t pt-4">
                                <p className="flex items-center gap-2 text-sm font-medium">
                                    <MessageSquare className="size-4" />
                                    ความคิดเห็น ({comments.length})
                                </p>

                                {comments.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">
                                        ยังไม่มีความคิดเห็นในงานนี้
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {comments.map((c) => (
                                            <li key={c.id} className="flex gap-3">
                                                <PersonChip person={c.author} size={28} avatarOnly />
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-baseline gap-2 text-sm">
                                                        <span className="font-medium">
                                                            {c.author.name}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">
                                                            {formatRelative(c.createdAt)}
                                                        </span>
                                                    </p>
                                                    <p className="text-sm whitespace-pre-wrap">
                                                        {c.body}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="flex gap-2">
                                    <Textarea
                                        value={commentBody}
                                        onChange={(e) => setCommentBody(e.target.value)}
                                        rows={2}
                                        placeholder="พิมพ์ความคิดเห็น..."
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void sendComment()}
                                        disabled={busy || commentBody.trim().length === 0}
                                    >
                                        <Send className="size-4" />
                                        <span className="sr-only">ส่งความคิดเห็น</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2 sm:justify-between">
                    <div>
                        {isEdit && canManage && (
                            <Button
                                variant="outline"
                                onClick={() => setConfirmDelete(true)}
                                disabled={busy}
                            >
                                <Trash2 className="text-priority-critical size-4" />
                                ลบงาน
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            ปิด
                        </Button>
                        {(!isEdit || canEdit) && (
                            <Button
                                onClick={() => void save()}
                                disabled={busy || loading || form.title.trim().length < 3}
                            >
                                {busy && <Loader2 className="size-4 animate-spin" />}
                                บันทึก
                            </Button>
                        )}
                    </div>
                </DialogFooter>

                {/* ยืนยันการลบ — ซ้อนในกล่องเดิมเพื่อไม่ให้ต้องปิดกล่องรายละเอียดก่อน */}
                {confirmDelete && (
                    <div className="bg-muted/60 space-y-3 rounded-lg border p-4">
                        <p className="text-sm font-medium">ยืนยันลบงานนี้?</p>
                        <p className="text-muted-foreground text-sm">
                            &ldquo;{form.title}&rdquo; จะถูกลบถาวรพร้อมความคิดเห็นทั้งหมด
                            หากมีบันทึกเวลาทำงานผูกอยู่ ระบบจะไม่ยอมให้ลบ
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDelete(false)}
                                disabled={busy}
                            >
                                ยกเลิก
                            </Button>
                            <Button size="sm" onClick={() => void remove()} disabled={busy}>
                                {busy && <Loader2 className="size-4 animate-spin" />}
                                ลบถาวร
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
