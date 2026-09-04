"use client"

// หน้าจัดการ Service Catalog — หมวดหลัก / หมวดย่อย / ผู้รับผิดชอบเริ่มต้น (เลือกได้หลายคน)
// อ้างอิง F1.8 (Service Catalog CRUD), F2.7 + F2.11 (ค่าที่ใช้ auto-assign ตามภาระงาน), F2.12

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    Plus,
    RefreshCw,
    Pencil,
    Power,
    Trash2,
    Layers,
    ChevronRight,
    Loader2,
} from "lucide-react"
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
import {
    readError,
    slugifyClient,
    type Category,
    type DirectoryAgent,
    type DirectoryTeam,
} from "@/lib/ticket-types"

interface FormState {
    id?: string
    name: string
    slug: string
    parentId: string
    description: string
    defaultTeamId: string
    /// ผู้รับผิดชอบเริ่มต้นหลายคน — auto-assign เลือกคนที่ภาระงานน้อยที่สุดจากรายชื่อนี้ (F2.11)
    assigneeIds: string[]
    active: boolean
    sortOrder: number
}

const EMPTY_FORM: FormState = {
    name: "",
    slug: "",
    parentId: "",
    description: "",
    defaultTeamId: "",
    assigneeIds: [],
    active: true,
    sortOrder: 0,
}

export default function CatalogContent() {
    const [categories, setCategories] = useState<Category[]>([])
    const [agents, setAgents] = useState<DirectoryAgent[]>([])
    const [teams, setTeams] = useState<DirectoryTeam[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [deleting, setDeleting] = useState<Category | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/categories?all=1")
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดหมวดหมู่ได้"))
                return
            }
            const data = (await res.json()) as { categories: Category[] }
            setCategories(data.categories)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
        void (async () => {
            const res = await fetch("/api/directory")
            if (res.ok) {
                const d = (await res.json()) as { agents: DirectoryAgent[]; teams: DirectoryTeam[] }
                setAgents(d.agents)
                setTeams(d.teams)
            }
        })()
    }, [load])

    /// จัดโครงสร้างเป็นหมวดหลัก → หมวดย่อย
    const tree = useMemo(() => {
        const parents = categories.filter((c) => !c.parentId)
        return parents.map((p) => ({
            parent: p,
            children: categories.filter((c) => c.parentId === p.id),
        }))
    }, [categories])

    const parentOptions = useMemo(() => categories.filter((c) => !c.parentId), [categories])

    const openCreate = (parentId = "") => {
        setForm({ ...EMPTY_FORM, parentId })
        setFormOpen(true)
    }

    const openEdit = (c: Category) => {
        setForm({
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId ?? "",
            description: c.description ?? "",
            defaultTeamId: c.defaultTeamId ?? "",
            assigneeIds: c.assignees.map((a) => a.user.id),
            active: c.active,
            sortOrder: c.sortOrder,
        })
        setFormOpen(true)
    }

    const submit = async () => {
        if (form.name.trim().length < 2) return toast.error("กรุณากรอกชื่อหมวดหมู่")
        // ชื่อภาษาไทยล้วนจะสร้าง slug อัตโนมัติไม่ได้ ต้องบอกให้ผู้ใช้กรอกเอง
        if (form.slug.trim().length === 0) {
            return toast.error("กรุณากรอก slug เป็นภาษาอังกฤษ เช่น network หรือ user-account")
        }
        if (!/^[a-z0-9-]+$/.test(form.slug)) return toast.error("slug ใช้ได้เฉพาะ a-z, 0-9 และ -")

        setBusy(true)
        try {
            const payload = {
                name: form.name.trim(),
                slug: form.slug.trim(),
                parentId: form.parentId || null,
                description: form.description.trim() || null,
                defaultTeamId: form.defaultTeamId || null,
                assigneeIds: form.assigneeIds,
                active: form.active,
                sortOrder: form.sortOrder,
            }
            const res = await fetch(
                form.id ? `/api/categories/${form.id}` : "/api/categories",
                {
                    method: form.id ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            )
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกหมวดหมู่ได้"))
                return
            }
            toast.success(form.id ? "แก้ไขหมวดหมู่เรียบร้อย" : "เพิ่มหมวดหมู่เรียบร้อย")
            setFormOpen(false)
            await load()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const toggleActive = async (c: Category) => {
        const res = await fetch(`/api/categories/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !c.active }),
        })
        if (!res.ok) {
            toast.error(await readError(res, "ไม่สามารถเปลี่ยนสถานะได้"))
            return
        }
        toast.success(c.active ? "ปิดใช้งานหมวดหมู่แล้ว" : "เปิดใช้งานหมวดหมู่แล้ว")
        await load()
    }

    const confirmDelete = async () => {
        if (!deleting) return
        const res = await fetch(`/api/categories/${deleting.id}`, { method: "DELETE" })
        if (!res.ok) {
            toast.error(await readError(res, "ไม่สามารถลบหมวดหมู่ได้"))
            setDeleting(null)
            return
        }
        const data = (await res.json()) as { deleted: boolean }
        toast.success(
            data.deleted ? "ลบหมวดหมู่เรียบร้อย" : "หมวดหมู่มี Ticket อ้างอยู่ จึงปิดใช้งานแทนการลบ"
        )
        setDeleting(null)
        await load()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Service Catalog</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        หมวดหมู่บริการที่ผู้ใช้เลือกตอนแจ้งปัญหา
                        พร้อมทีมและเจ้าหน้าที่ที่ระบบมอบหมายให้อัตโนมัติ
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => void load()}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                    <Button onClick={() => openCreate()}>
                        <Plus className="size-4" />
                        เพิ่มหมวดหลัก
                    </Button>
                </div>
            </div>

            {loading ? (
                <Skeleton className="h-64 w-full" />
            ) : tree.length === 0 ? (
                <Card>
                    <CardContent className="text-muted-foreground py-14 text-center text-sm">
                        <Layers className="mx-auto mb-3 size-8 opacity-40" />
                        ยังไม่มีหมวดหมู่บริการ
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {tree.map(({ parent, children }) => (
                        <Card key={parent.id} className="overflow-hidden py-0">
                            <CardHeader className="bg-muted/40 flex flex-row flex-wrap items-center justify-between gap-3 border-b py-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">{parent.name}</span>
                                        <span className="text-muted-foreground font-mono text-xs">
                                            {parent.slug}
                                        </span>
                                        {!parent.active && (
                                            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                                ปิดใช้งาน
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        {children.length} หมวดย่อย · {parent._count.tickets} Ticket ·
                                        ผู้รับผิดชอบ: {assigneeLabel(parent)}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openCreate(parent.id)}>
                                        <Plus className="size-4" />
                                        หมวดย่อย
                                    </Button>
                                    <RowActions
                                        category={parent}
                                        onEdit={() => openEdit(parent)}
                                        onToggle={() => void toggleActive(parent)}
                                        onDelete={() => setDeleting(parent)}
                                    />
                                </div>
                            </CardHeader>

                            <CardContent className="p-0">
                                {children.length === 0 ? (
                                    <p className="text-muted-foreground px-6 py-4 text-sm">
                                        ยังไม่มีหมวดย่อย
                                    </p>
                                ) : (
                                    children.map((c, i) => (
                                        <div
                                            key={c.id}
                                            className={
                                                "flex flex-wrap items-center gap-3 px-6 py-3" +
                                                (i > 0 ? " border-t" : "")
                                            }
                                        >
                                            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                                            <div className="min-w-[200px] flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-medium">{c.name}</span>
                                                    <span className="text-muted-foreground font-mono text-xs">
                                                        {c.slug}
                                                    </span>
                                                    {!c.active && (
                                                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                                            ปิดใช้งาน
                                                        </span>
                                                    )}
                                                </div>
                                                {c.description && (
                                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                                        {c.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-muted-foreground w-[200px] text-xs">
                                                <p>ทีม: {c.defaultTeam?.name ?? "—"}</p>
                                                <p>ผู้รับผิดชอบ: {assigneeLabel(c)}</p>
                                            </div>
                                            <span className="text-muted-foreground w-20 text-xs">
                                                {c._count.tickets} Ticket
                                            </span>
                                            <RowActions
                                                category={c}
                                                onEdit={() => openEdit(c)}
                                                onToggle={() => void toggleActive(c)}
                                                onDelete={() => setDeleting(c)}
                                            />
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ฟอร์มเพิ่ม / แก้ไข */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{form.id ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}</DialogTitle>
                        <DialogDescription>
                            ผู้รับผิดชอบและทีมที่ตั้งไว้จะถูกใช้มอบหมายงานอัตโนมัติเมื่อมี Ticket เข้าหมวดนี้
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5">ชื่อหมวดหมู่</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => {
                                    const name = e.target.value
                                    setForm((f) => ({
                                        ...f,
                                        name,
                                        // สร้าง slug ให้อัตโนมัติเฉพาะตอนเพิ่มใหม่
                                        slug: f.id ? f.slug : slugifyClient(name),
                                    }))
                                }}
                                placeholder="เช่น เครือข่ายและอินเทอร์เน็ต"
                            />
                        </div>

                        <div>
                            <Label className="mb-1.5">slug</Label>
                            <Input
                                value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                                placeholder="network"
                                className="font-mono"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                ใช้ a-z, 0-9 และ - เท่านั้น ห้ามซ้ำกับหมวดอื่น ·
                                ชื่อภาษาไทยสร้าง slug ให้อัตโนมัติไม่ได้ กรุณากรอกเอง
                            </p>
                        </div>

                        <div>
                            <Label className="mb-1.5">หมวดหลัก</Label>
                            <select
                                value={form.parentId}
                                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">— เป็นหมวดหลักเอง —</option>
                                {parentOptions
                                    .filter((p) => p.id !== form.id)
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <Label className="mb-1.5">คำอธิบาย</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                                rows={2}
                                placeholder="อธิบายว่าหมวดนี้ครอบคลุมงานแบบใด"
                            />
                        </div>

                        <div>
                            <Label className="mb-1.5">ทีมที่รับผิดชอบเริ่มต้น</Label>
                            <select
                                value={form.defaultTeamId}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, defaultTeamId: e.target.value }))
                                }
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">— ไม่ระบุ —</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-muted-foreground mt-1.5 text-xs">
                                ใช้เมื่อไม่มีผู้รับผิดชอบที่รับงานได้ในรายชื่อด้านล่าง
                            </p>
                        </div>

                        <div>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <Label>ผู้รับผิดชอบเริ่มต้น (auto-assign)</Label>
                                {form.assigneeIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, assigneeIds: [] }))}
                                        className="text-muted-foreground hover:text-foreground text-xs underline"
                                    >
                                        ล้างทั้งหมด
                                    </button>
                                )}
                            </div>
                            <p className="text-muted-foreground mb-2 text-xs">
                                เลือกได้หลายคน — เมื่อมี Ticket เข้าหมวดนี้
                                ระบบจะมอบหมายให้คนที่ถืองานอยู่น้อยที่สุดโดยอัตโนมัติ
                                (เท่ากันจะให้คนที่เว้นว่างจากหมวดนี้นานที่สุด)
                            </p>
                            <div className="max-h-52 overflow-y-auto rounded-md border">
                                {agents.length === 0 ? (
                                    <p className="text-muted-foreground px-3 py-4 text-sm">
                                        ยังไม่มีเจ้าหน้าที่ในระบบ
                                    </p>
                                ) : (
                                    agents.map((a, i) => {
                                        const checked = form.assigneeIds.includes(a.id)
                                        return (
                                            <label
                                                key={a.id}
                                                className={
                                                    "hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2" +
                                                    (i > 0 ? " border-t" : "")
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            assigneeIds: checked
                                                                ? f.assigneeIds.filter((id) => id !== a.id)
                                                                : [...f.assigneeIds, a.id],
                                                        }))
                                                    }
                                                    className="size-4 shrink-0"
                                                />
                                                <span className="min-w-0 flex-1 truncate text-sm">
                                                    {a.name}
                                                    <span className="text-muted-foreground ml-2 text-xs">
                                                        {a.position ?? a.role}
                                                    </span>
                                                </span>
                                                <span className="text-muted-foreground shrink-0 text-xs">
                                                    ถืออยู่ {a.openTickets} งาน
                                                </span>
                                            </label>
                                        )
                                    })
                                )}
                            </div>
                            <p className="text-muted-foreground mt-1.5 text-xs">
                                เลือกแล้ว {form.assigneeIds.length} คน
                                {form.assigneeIds.length === 0 &&
                                    " — ไม่เลือกเลย ระบบจะมอบหมายตามทีมที่ตั้งไว้แทน"}
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5">ลำดับการแสดง</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.sortOrder}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                                    }
                                />
                            </div>
                            <div className="flex items-end">
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={form.active}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, active: e.target.checked }))
                                        }
                                        className="size-4"
                                    />
                                    เปิดใช้งาน (แสดงในฟอร์มแจ้งปัญหา)
                                </label>
                            </div>
                        </div>
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
                        <AlertDialogTitle>ลบหมวดหมู่ &quot;{deleting?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting && deleting._count.tickets > 0
                                ? `หมวดนี้มี ${deleting._count.tickets} Ticket อ้างอยู่ ระบบจะปิดใช้งานแทนการลบ เพื่อรักษาประวัติเดิมไว้`
                                : "หมวดนี้ยังไม่มี Ticket อ้างอยู่ จึงจะถูกลบออกถาวร"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void confirmDelete()}>ยืนยัน</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

/// สรุปชื่อผู้รับผิดชอบของหมวดให้พอดีบรรทัดเดียว — เกิน 2 คนย่อเป็น "+N"
function assigneeLabel(c: Category) {
    const names = c.assignees.map((a) => a.user.name)
    if (names.length === 0) return "—"
    if (names.length <= 2) return names.join(", ")
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
}

function RowActions({
    category,
    onEdit,
    onToggle,
    onDelete,
}: {
    category: Category
    onEdit: () => void
    onToggle: () => void
    onDelete: () => void
}) {
    return (
        <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} title="แก้ไข">
                <Pencil className="size-4" />
                <span className="sr-only">แก้ไข</span>
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                title={category.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            >
                <Power className={category.active ? "size-4" : "text-muted-foreground size-4"} />
                <span className="sr-only">{category.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="ลบ">
                <Trash2 className="text-destructive size-4" />
                <span className="sr-only">ลบ</span>
            </Button>
        </div>
    )
}
