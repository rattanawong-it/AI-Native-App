"use client"

// แท็บ "งานส่วนตัว" ของหน้า My Work — เพิ่ม/แก้/ลบ/ติ๊กเสร็จ
// อ้างอิง F3.3 (CRUD TodoItem) และ F3.4 (ติ๊กเสร็จ + บันทึก doneAt)
//
// งานส่วนตัวเป็นของเจ้าตัวคนเดียว ไม่มีใครเห็นของใคร — ฝั่ง API บังคับ `ownerId = me` ทุกเส้น

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, ListTodo, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { PriorityBadge } from "@/components/ticket/ticket-badges"
import { PRIORITY_LEVELS, PRIORITY_LABEL, type Priority } from "@/lib/priority"
import { readError, formatThaiDate } from "@/lib/ticket-types"
import type { TodoListResponse, TodoRow } from "@/lib/worklog-types"

const STATE_TABS = [
    { key: "pending", label: "ค้างอยู่" },
    { key: "done", label: "เสร็จแล้ว" },
    { key: "all", label: "ทั้งหมด" },
] as const

interface FormState {
    id?: string
    title: string
    note: string
    /// "YYYY-MM-DD" จาก <input type="date"> · ว่าง = ไม่กำหนดวันส่ง
    dueDate: string
    priority: Priority
}

const EMPTY_FORM: FormState = { title: "", note: "", dueDate: "", priority: "medium" }

/// แปลงค่า dueDate จาก API (ISO เต็ม) ให้ใส่ใน <input type="date"> ได้ตามวันไทย
function toDateInput(iso: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function TodoPanel({ onChanged }: { onChanged: () => void }) {
    const [state, setState] = useState<string>("pending")
    const [todos, setTodos] = useState<TodoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [deleting, setDeleting] = useState<TodoRow | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/todos?state=${state}&pageSize=100`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดงานส่วนตัวได้"))
                return
            }
            setTodos(((await res.json()) as TodoListResponse).todos)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [state])

    useEffect(() => {
        void load()
    }, [load])

    const openCreate = () => {
        setForm(EMPTY_FORM)
        setFormOpen(true)
    }

    const openEdit = (todo: TodoRow) => {
        setForm({
            id: todo.id,
            title: todo.title,
            note: todo.note ?? "",
            dueDate: toDateInput(todo.dueDate),
            priority: todo.priority as Priority,
        })
        setFormOpen(true)
    }

    const save = async () => {
        setBusy(true)
        try {
            const payload = {
                title: form.title.trim(),
                note: form.note.trim() || null,
                dueDate: form.dueDate || null,
                priority: form.priority,
            }
            const res = await fetch(form.id ? `/api/todos/${form.id}` : "/api/todos", {
                method: form.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกงานส่วนตัวไม่สำเร็จ"))
                return
            }
            toast.success(form.id ? "แก้ไขงานเรียบร้อย" : "เพิ่มงานเรียบร้อย")
            setFormOpen(false)
            await load()
            onChanged()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    /// F3.4 — ติ๊กเสร็จ/ยกเลิกติ๊ก · อัปเดตหน้าจอทันทีแล้วค่อยยืนยันกับเซิร์ฟเวอร์
    const toggleDone = async (todo: TodoRow) => {
        const next = !todo.isDone
        setTodos((list) => list.map((t) => (t.id === todo.id ? { ...t, isDone: next } : t)))
        try {
            const res = await fetch(`/api/todos/${todo.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isDone: next }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "อัปเดตสถานะงานไม่สำเร็จ"))
                await load()
                return
            }
            await load()
            onChanged()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
            await load()
        }
    }

    const remove = async () => {
        if (!deleting) return
        setBusy(true)
        try {
            const res = await fetch(`/api/todos/${deleting.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบงานส่วนตัวไม่สำเร็จ"))
                return
            }
            toast.success("ลบงานเรียบร้อย")
            setDeleting(null)
            await load()
            onChanged()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {STATE_TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setState(t.key)}
                            className={
                                state === t.key
                                    ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                                    : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <Button onClick={openCreate}>
                    <Plus className="size-4" />
                    เพิ่มงานส่วนตัว
                </Button>
            </div>

            <Card className="overflow-hidden py-0">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="space-y-3 p-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : todos.length === 0 ? (
                        <div className="text-muted-foreground p-12 text-center text-sm">
                            <ListTodo className="mx-auto mb-3 size-8 opacity-40" />
                            {state === "done" ? "ยังไม่มีงานที่ทำเสร็จ" : "ยังไม่มีงานส่วนตัว"}
                        </div>
                    ) : (
                        todos.map((todo, i) => {
                            const overdue =
                                !todo.isDone && todo.dueDate && new Date(todo.dueDate) < new Date()
                            return (
                                <div
                                    key={todo.id}
                                    className={
                                        "flex items-start gap-3 px-6 py-3.5" +
                                        (i > 0 ? " border-t" : "")
                                    }
                                >
                                    <Checkbox
                                        checked={todo.isDone}
                                        onCheckedChange={() => void toggleDone(todo)}
                                        className="mt-1"
                                        aria-label={todo.isDone ? "ยกเลิกติ๊กเสร็จ" : "ติ๊กว่าเสร็จแล้ว"}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={
                                                todo.isDone
                                                    ? "text-muted-foreground truncate text-sm line-through"
                                                    : "truncate text-sm font-medium"
                                            }
                                        >
                                            {todo.title}
                                        </p>
                                        {todo.note && (
                                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                                {todo.note}
                                            </p>
                                        )}
                                        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                                            <PriorityBadge priority={todo.priority} />
                                            <span className={overdue ? "text-sla-breached font-medium" : ""}>
                                                {todo.dueDate
                                                    ? `กำหนดส่ง ${formatThaiDate(todo.dueDate)}`
                                                    : "ไม่กำหนดวันส่ง"}
                                            </span>
                                            {todo.isDone && todo.doneAt && (
                                                <span className="text-status-resolved-fg flex items-center gap-1">
                                                    <CheckCircle2 className="size-3.5" />
                                                    เสร็จ {formatThaiDate(todo.doneAt)}
                                                </span>
                                            )}
                                            {todo._count.workLogs > 0 && (
                                                <span>บันทึกเวลา {todo._count.workLogs} รายการ</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(todo)}
                                        >
                                            <Pencil className="size-4" />
                                            <span className="sr-only">แก้ไข</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleting(todo)}
                                        >
                                            <Trash2 className="text-destructive size-4" />
                                            <span className="sr-only">ลบ</span>
                                        </Button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </CardContent>
            </Card>

            {/* ฟอร์มเพิ่ม/แก้ไข */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{form.id ? "แก้ไขงานส่วนตัว" : "เพิ่มงานส่วนตัว"}</DialogTitle>
                        <DialogDescription>
                            งานส่วนตัวเห็นได้เฉพาะตัวคุณเอง ใช้จดสิ่งที่ต้องทำที่ไม่ได้มาจาก Ticket
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5">หัวข้องาน</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="เช่น ตรวจสอบ log ของเครื่องแม่ข่ายสำรอง"
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5">บันทึกเพิ่มเติม (ไม่บังคับ)</Label>
                            <Textarea
                                value={form.note}
                                onChange={(e) => setForm({ ...form, note: e.target.value })}
                                rows={3}
                                placeholder="รายละเอียดที่ต้องจำ..."
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">กำหนดส่ง (ไม่บังคับ)</Label>
                                <Input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">ระดับความสำคัญ</Label>
                                <select
                                    value={form.priority}
                                    onChange={(e) =>
                                        setForm({ ...form, priority: e.target.value as Priority })
                                    }
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    {PRIORITY_LEVELS.map((p) => (
                                        <option key={p} value={p}>
                                            {PRIORITY_LABEL[p]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={() => void save()}
                            disabled={busy || form.title.trim().length < 2}
                        >
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
                        <AlertDialogTitle>ลบงานส่วนตัวนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{deleting?.title}&rdquo; จะถูกลบถาวร
                            หากมีบันทึกเวลาผูกอยู่ ระบบจะไม่ยอมให้ลบจนกว่าจะลบบันทึกเวลาก่อน
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
