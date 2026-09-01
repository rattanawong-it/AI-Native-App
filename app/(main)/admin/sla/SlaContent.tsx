"use client"

// หน้าตั้งค่านโยบาย SLA — เวลาตอบกลับ / เวลาแก้ไข ต่อระดับความสำคัญ และต่อหมวดหมู่
// อ้างอิง F4.1 · เวลาทุกค่าเป็น "นาทีทำการ" ที่นับตามปฏิทินในหน้า admin/calendar

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, RefreshCw, Pencil, Trash2, Loader2, Timer, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
    readError,
    formatBusinessMinutes,
    type Category,
    type SlaPolicy,
} from "@/lib/ticket-types"

interface FormState {
    id?: string
    name: string
    priority: Priority
    categoryId: string
    responseMinutes: number
    resolutionMinutes: number
    active: boolean
}

/// ค่าที่ระบบใช้เมื่อยังไม่มีนโยบายของระดับนั้นใน DB
/// (ตรงกับ FALLBACK_SLA ใน lib/ticket-service.ts — แก้ที่นั่นแล้วต้องแก้ที่นี่ด้วย)
const FALLBACK: Record<Priority, { response: number; resolution: number }> = {
    critical: { response: 30, resolution: 240 },
    high: { response: 60, resolution: 480 },
    medium: { response: 240, resolution: 1440 },
    low: { response: 480, resolution: 3360 },
}

function formFor(priority: Priority): FormState {
    return {
        name: `SLA — ${PRIORITY_LABEL[priority]}`,
        priority,
        categoryId: "",
        responseMinutes: FALLBACK[priority].response,
        resolutionMinutes: FALLBACK[priority].resolution,
        active: true,
    }
}

export default function SlaContent() {
    const [policies, setPolicies] = useState<SlaPolicy[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState<FormState>(formFor("medium"))
    /// ผู้ใช้พิมพ์ชื่อเองแล้วหรือยัง — ถ้ายัง ชื่อจะเปลี่ยนตามระดับความสำคัญที่เลือก
    const [nameTouched, setNameTouched] = useState(false)
    const [deleting, setDeleting] = useState<SlaPolicy | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/sla-policies")
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดนโยบาย SLA ได้"))
                return
            }
            const data = (await res.json()) as { policies: SlaPolicy[] }
            setPolicies(data.policies)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
        void (async () => {
            const res = await fetch("/api/categories?all=1")
            if (res.ok) {
                const d = (await res.json()) as { categories: Category[] }
                setCategories(d.categories)
            }
        })()
    }, [load])

    /// นโยบายรวมใช้กับทุกหมวด — แสดงแยกจากนโยบายที่เจาะจงหมวดหมู่
    const general = useMemo(() => policies.filter((p) => !p.categoryId), [policies])
    const specific = useMemo(() => policies.filter((p) => p.categoryId), [policies])

    /// ระดับที่ยังไม่มีนโยบายรวมที่เปิดใช้งาน — ระบบจะใช้ค่าสำรองในโค้ดแทน จึงต้องเตือน
    const missing = useMemo(
        () => PRIORITY_LEVELS.filter((p) => !general.some((g) => g.priority === p && g.active)),
        [general]
    )

    const openCreate = (priority: Priority = "medium") => {
        setForm(formFor(priority))
        setNameTouched(false)
        setFormOpen(true)
    }

    const openEdit = (p: SlaPolicy) => {
        setForm({
            id: p.id,
            name: p.name,
            priority: p.priority as Priority,
            categoryId: p.categoryId ?? "",
            responseMinutes: p.responseMinutes,
            resolutionMinutes: p.resolutionMinutes,
            active: p.active,
        })
        setNameTouched(true)
        setFormOpen(true)
    }

    const submit = async () => {
        if (form.name.trim().length < 2) return toast.error("กรุณากรอกชื่อนโยบาย")
        if (form.responseMinutes < 1 || form.resolutionMinutes < 1) {
            return toast.error("เวลาต้องมากกว่า 0 นาที")
        }
        if (form.resolutionMinutes < form.responseMinutes) {
            return toast.error("เวลาแก้ไขต้องไม่น้อยกว่าเวลาตอบกลับ")
        }

        setBusy(true)
        try {
            const payload = {
                name: form.name.trim(),
                priority: form.priority,
                categoryId: form.categoryId || null,
                responseMinutes: form.responseMinutes,
                resolutionMinutes: form.resolutionMinutes,
                active: form.active,
            }
            const res = await fetch(form.id ? `/api/sla-policies/${form.id}` : "/api/sla-policies", {
                method: form.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกนโยบายได้"))
                return
            }
            toast.success(form.id ? "แก้ไขนโยบายเรียบร้อย" : "เพิ่มนโยบายเรียบร้อย")
            setFormOpen(false)
            await load()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const toggleActive = async (p: SlaPolicy) => {
        const res = await fetch(`/api/sla-policies/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !p.active }),
        })
        if (!res.ok) {
            toast.error(await readError(res, "ไม่สามารถเปลี่ยนสถานะได้"))
            return
        }
        toast.success(p.active ? "ปิดใช้งานนโยบายแล้ว" : "เปิดใช้งานนโยบายแล้ว")
        await load()
    }

    const confirmDelete = async () => {
        if (!deleting) return
        const res = await fetch(`/api/sla-policies/${deleting.id}`, { method: "DELETE" })
        if (!res.ok) {
            toast.error(await readError(res, "ไม่สามารถลบนโยบายได้"))
            setDeleting(null)
            return
        }
        toast.success("ลบนโยบายเรียบร้อย")
        setDeleting(null)
        await load()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">นโยบาย SLA</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        กำหนดเวลาตอบกลับและเวลาแก้ไขของแต่ละระดับความสำคัญ · ทุกค่าเป็น{" "}
                        <strong>นาทีทำการ</strong> ที่นับตามปฏิทินใน{" "}
                        <Link href="/admin/calendar" className="underline underline-offset-2">
                            หน้าเวลาทำการ
                        </Link>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => void load()}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    <Button onClick={() => openCreate()}>
                        <Plus className="size-4" />
                        เพิ่มนโยบาย
                    </Button>
                </div>
            </div>

            {!loading && missing.length > 0 && (
                <Card className="border-priority-high/40 bg-priority-high/5">
                    <CardContent className="flex flex-wrap items-center gap-2 py-4 text-sm">
                        <CalendarClock className="text-priority-high size-4 shrink-0" />
                        <span>
                            ยังไม่มีนโยบายรวมที่เปิดใช้งานของระดับ{" "}
                            <strong>{missing.map((m) => PRIORITY_LABEL[m]).join(" · ")}</strong> —
                            ระบบจะใช้ค่าสำรองที่ฝังไว้ในโค้ดแทนจนกว่าจะตั้งค่า
                        </span>
                        {missing.map((m) => (
                            <Button key={m} size="sm" variant="outline" onClick={() => openCreate(m)}>
                                ตั้งค่า {PRIORITY_LABEL[m]}
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <Skeleton className="h-64 w-full" />
            ) : (
                <>
                    <PolicyTable
                        title="นโยบายรวม (ใช้กับทุกหมวดหมู่)"
                        description="ค่าเริ่มต้นที่ใช้เมื่อหมวดหมู่ของ Ticket ไม่มีนโยบายเฉพาะของตัวเอง"
                        rows={general}
                        onEdit={openEdit}
                        onToggle={(p) => void toggleActive(p)}
                        onDelete={setDeleting}
                    />
                    <PolicyTable
                        title="นโยบายเฉพาะหมวดหมู่"
                        description="ใช้แทนนโยบายรวมเมื่อ Ticket อยู่ในหมวดหมู่ที่ระบุ"
                        rows={specific}
                        onEdit={openEdit}
                        onToggle={(p) => void toggleActive(p)}
                        onDelete={setDeleting}
                    />
                </>
            )}

            {/* ฟอร์มเพิ่ม / แก้ไข */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{form.id ? "แก้ไขนโยบาย SLA" : "เพิ่มนโยบาย SLA"}</DialogTitle>
                        <DialogDescription>
                            นโยบายมีผลกับ Ticket ที่แจ้งเข้ามาหลังบันทึกเท่านั้น —
                            ใบเดิมยังใช้กำหนดเวลาที่คำนวณไว้แล้ว
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5">ชื่อนโยบาย</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => {
                                    setNameTouched(true)
                                    setForm((f) => ({ ...f, name: e.target.value }))
                                }}
                                placeholder="เช่น SLA — วิกฤต"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">ระดับความสำคัญ</Label>
                                <select
                                    value={form.priority}
                                    onChange={(e) => {
                                        const priority = e.target.value as Priority
                                        setForm((f) => ({
                                            ...f,
                                            priority,
                                            // ยังไม่ได้ตั้งชื่อเอง → ให้ชื่อตามระดับที่เลือก
                                            name: nameTouched
                                                ? f.name
                                                : `SLA — ${PRIORITY_LABEL[priority]}`,
                                        }))
                                    }}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    {PRIORITY_LEVELS.map((p) => (
                                        <option key={p} value={p}>
                                            {PRIORITY_LABEL[p]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="mb-1.5">หมวดหมู่บริการ</Label>
                                <select
                                    value={form.categoryId}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, categoryId: e.target.value }))
                                    }
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    <option value="">— ทุกหมวดหมู่ (นโยบายรวม) —</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.parentId ? "— " : ""}
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <MinuteField
                                label="เวลาตอบกลับ (นาทีทำการ)"
                                value={form.responseMinutes}
                                onChange={(responseMinutes) =>
                                    setForm((f) => ({ ...f, responseMinutes }))
                                }
                            />
                            <MinuteField
                                label="เวลาแก้ไข (นาทีทำการ)"
                                value={form.resolutionMinutes}
                                onChange={(resolutionMinutes) =>
                                    setForm((f) => ({ ...f, resolutionMinutes }))
                                }
                            />
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                                className="size-4"
                            />
                            เปิดใช้งานนโยบายนี้
                        </label>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => void submit()} disabled={busy}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            บันทึก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ยืนยันการลบ */}
            <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบนโยบาย &quot;{deleting?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ticket ที่แจ้งไปแล้วไม่ได้รับผลกระทบ เพราะเก็บกำหนดเวลาไว้ในใบของตัวเองแล้ว
                            · ใบที่แจ้งหลังจากนี้จะใช้นโยบายรวมของระดับเดียวกันแทน
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void confirmDelete()}>
                            ยืนยัน
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

/// ช่องกรอกนาที พร้อมข้อความแปลงเป็นชั่วโมง/วันทำการให้เห็นทันที
function MinuteField({
    label,
    value,
    onChange,
}: {
    label: string
    value: number
    onChange: (v: number) => void
}) {
    return (
        <div>
            <Label className="mb-1.5">{label}</Label>
            <Input
                type="number"
                min={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
            />
            <p className="text-muted-foreground mt-1 text-xs">= {formatBusinessMinutes(value)}</p>
        </div>
    )
}

function PolicyTable({
    title,
    description,
    rows,
    onEdit,
    onToggle,
    onDelete,
}: {
    title: string
    description: string
    rows: SlaPolicy[]
    onEdit: (p: SlaPolicy) => void
    onToggle: (p: SlaPolicy) => void
    onDelete: (p: SlaPolicy) => void
}) {
    return (
        <Card className="overflow-hidden py-0">
            <CardHeader className="bg-muted/40 flex flex-row flex-wrap items-center justify-between gap-3 border-b py-3">
                <div className="min-w-0">
                    <p className="font-medium">{title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
                </div>
                <span className="text-muted-foreground text-xs">{rows.length} รายการ</span>
            </CardHeader>

            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <div className="text-muted-foreground px-6 py-6 text-center text-sm">
                        <Timer className="mx-auto mb-2 size-6 opacity-40" />
                        ยังไม่มีนโยบายในกลุ่มนี้
                    </div>
                ) : (
                    rows.map((p, i) => (
                        <div
                            key={p.id}
                            className={
                                "flex flex-wrap items-center gap-3 px-6 py-3" +
                                (i > 0 ? " border-t" : "")
                            }
                        >
                            <PriorityBadge priority={p.priority} />
                            <div className="min-w-[160px] flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium">{p.name}</span>
                                    {!p.active && (
                                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                            ปิดใช้งาน
                                        </span>
                                    )}
                                </div>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {p.category ? `หมวด: ${p.category.name}` : "ใช้กับทุกหมวดหมู่"}
                                </p>
                            </div>
                            <div className="text-muted-foreground w-[190px] text-xs">
                                <p>
                                    ตอบกลับ:{" "}
                                    <span className="text-foreground">
                                        {formatBusinessMinutes(p.responseMinutes)}
                                    </span>
                                </p>
                                <p>
                                    แก้ไข:{" "}
                                    <span className="text-foreground">
                                        {formatBusinessMinutes(p.resolutionMinutes)}
                                    </span>
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                                <Button variant="ghost" size="sm" onClick={() => onToggle(p)}>
                                    {p.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onEdit(p)}
                                    title="แก้ไข"
                                >
                                    <Pencil className="size-4" />
                                    <span className="sr-only">แก้ไข</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onDelete(p)}
                                    title="ลบ"
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
    )
}
