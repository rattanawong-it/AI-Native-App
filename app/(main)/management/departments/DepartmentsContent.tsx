"use client"

// หน้าทะเบียนหน่วยงาน — เพิ่ม / แก้ไข / ย้ายหน่วยงานแม่ / เปิด-ปิดใช้งาน / ลบ
// ข้อมูลตั้งต้นนำเข้าจากรหัสงานสารบรรณ (prisma/data/departments.sql) แล้วแก้ต่อที่นี่ได้
//
// ชื่อหน่วยงานซ้ำกันได้ (เช่น "สำนักงานธุรการและประสานงาน" มี 13 แห่ง)
// ทุกที่ที่แสดงหน่วยงานจึงต้องมีรหัสและเส้นทางหน่วยงานแม่กำกับเสมอ

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw, Pencil, Power, Trash2, Building2, Search, Loader2, X } from "lucide-react"
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
import { readError } from "@/lib/ticket-types"
import {
    departmentPath,
    type DepartmentListResponse,
    type DepartmentRow,
} from "@/lib/department-types"

const LEVEL_LABEL: Record<number, string> = {
    1: "สำนัก / คณะ",
    2: "ฝ่าย",
    3: "งาน",
}

interface FormState {
    id: string | null
    name: string
    code: string
    parent: DepartmentRow | null
    active: boolean
}

const EMPTY_FORM: FormState = { id: null, name: "", code: "", parent: null, active: true }

export default function DepartmentsContent() {
    const [rows, setRows] = useState<DepartmentRow[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [showInactive, setShowInactive] = useState(true)
    const [loading, setLoading] = useState(true)

    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [formOpen, setFormOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<DepartmentRow | null>(null)

    // หน่วงการค้นหาเหมือนหน้าครุภัณฑ์ เพื่อไม่ยิง API ทุกตัวอักษร
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [search])

    const queryString = useMemo(() => {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" })
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
        if (showInactive) params.set("all", "1")
        return params.toString()
    }, [page, debouncedSearch, showInactive])

    const fetchDepartments = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/departments?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายชื่อหน่วยงานได้"))
                return
            }
            const data = (await res.json()) as DepartmentListResponse
            setRows(data.departments)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch {
            toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
        } finally {
            setLoading(false)
        }
    }, [queryString])

    useEffect(() => {
        void fetchDepartments()
    }, [fetchDepartments])

    function openCreate() {
        setForm(EMPTY_FORM)
        setFormOpen(true)
    }

    function openEdit(row: DepartmentRow) {
        setForm({
            id: row.id,
            name: row.name,
            code: row.code,
            // ตอนแก้ไขยังไม่รู้จักตัวหน่วยงานแม่เต็มๆ — ให้ผู้ใช้ค้นใหม่ถ้าจะย้าย
            parent: null,
            active: row.active,
        })
        setFormOpen(true)
    }

    async function submitForm() {
        if (form.name.trim().length < 2) {
            toast.error("กรุณากรอกชื่อหน่วยงานอย่างน้อย 2 ตัวอักษร")
            return
        }
        if (form.code.trim().length < 2) {
            toast.error("กรุณากรอกรหัสหน่วยงาน")
            return
        }

        setSaving(true)
        try {
            // ตอนแก้ไข ส่ง parentId เฉพาะเมื่อผู้ใช้เลือกหน่วยงานแม่ใหม่จริงๆ
            // ไม่งั้นการเปิดฟอร์มเฉยๆ จะเผลอย้ายหน่วยงานไปเป็นระดับบนสุด
            const payload: Record<string, unknown> = {
                name: form.name.trim(),
                code: form.code.trim(),
                active: form.active,
            }
            if (!form.id || form.parent) payload.parentId = form.parent?.id ?? null

            const res = await fetch(form.id ? `/api/departments/${form.id}` : "/api/departments", {
                method: form.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกหน่วยงานได้"))
                return
            }
            toast.success(form.id ? "แก้ไขหน่วยงานเรียบร้อย" : "เพิ่มหน่วยงานเรียบร้อย")
            setFormOpen(false)
            await fetchDepartments()
        } catch {
            toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
        } finally {
            setSaving(false)
        }
    }

    async function toggleActive(row: DepartmentRow) {
        try {
            const res = await fetch(`/api/departments/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !row.active }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถเปลี่ยนสถานะได้"))
                return
            }
            toast.success(row.active ? "ปิดใช้งานหน่วยงานแล้ว" : "เปิดใช้งานหน่วยงานแล้ว")
            await fetchDepartments()
        } catch {
            toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
        }
    }

    async function confirmDelete() {
        if (!deleting) return
        try {
            const res = await fetch(`/api/departments/${deleting.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถลบหน่วยงานได้"))
                return
            }
            const data = (await res.json()) as { deleted: boolean }
            toast.success(
                data.deleted
                    ? "ลบหน่วยงานเรียบร้อย"
                    : "หน่วยงานนี้มีข้อมูลอ้างอยู่ จึงปิดใช้งานแทนการลบ"
            )
            setDeleting(null)
            await fetchDepartments()
        } catch {
            toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
        }
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold">
                        <Building2 className="size-6" />
                        หน่วยงาน
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        ทะเบียนหน่วยงานตามรหัสงานสารบรรณ ใช้ในฟอร์มแจ้งปัญหา ทะเบียนครุภัณฑ์
                        และการระบุต้นสังกัดของผู้ใช้
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchDepartments()}>
                        <RefreshCw className="size-4" />
                        รีเฟรช
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="size-4" />
                        เพิ่มหน่วยงาน
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-64 flex-1">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="ค้นหาด้วยรหัสหรือชื่อหน่วยงาน"
                                className="pl-9"
                            />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => {
                                    setShowInactive(e.target.checked)
                                    setPage(1)
                                }}
                                className="size-4"
                            />
                            แสดงหน่วยงานที่ปิดใช้งานด้วย
                        </label>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="text-muted-foreground py-10 text-center text-sm">
                            ไม่พบหน่วยงานที่ค้นหา
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-muted-foreground border-b text-left">
                                    <tr>
                                        <th className="py-2 pr-3 font-medium">รหัส</th>
                                        <th className="py-2 pr-3 font-medium">ชื่อหน่วยงาน</th>
                                        <th className="py-2 pr-3 font-medium">ระดับ</th>
                                        <th className="py-2 pr-3 font-medium">สถานะ</th>
                                        <th className="py-2 font-medium">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id} className="border-b last:border-0">
                                            <td className="py-2.5 pr-3 font-mono text-xs">
                                                {row.code}
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                <div className={row.active ? "" : "opacity-60"}>
                                                    {row.name}
                                                </div>
                                                {row.ancestors.length > 0 && (
                                                    <div className="text-muted-foreground text-xs">
                                                        {departmentPath(row)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-muted-foreground py-2.5 pr-3 text-xs">
                                                {LEVEL_LABEL[row.level] ?? `ชั้น ${row.level}`}
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                {row.active ? (
                                                    <span className="text-xs">เปิดใช้งาน</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">
                                                        ปิดใช้งาน
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5">
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEdit(row)}
                                                        title="แก้ไข"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => void toggleActive(row)}
                                                        title={
                                                            row.active ? "ปิดใช้งาน" : "เปิดใช้งาน"
                                                        }
                                                    >
                                                        <Power className="size-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleting(row)}
                                                        title="ลบ"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-muted-foreground text-sm">
                            ทั้งหมด {total} รายการ · หน้า {page} จาก {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                ก่อนหน้า
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                ถัดไป
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{form.id ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน"}</DialogTitle>
                        <DialogDescription>
                            รหัสหน่วยงานห้ามซ้ำกับที่มีอยู่ · ระดับคำนวณให้อัตโนมัติจากหน่วยงานแม่
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5">รหัสหน่วยงาน</Label>
                            <Input
                                value={form.code}
                                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                placeholder="เช่น 010103"
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5">ชื่อหน่วยงาน</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="เช่น งานสารบรรณ"
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5">
                                หน่วยงานแม่{" "}
                                <span className="text-muted-foreground font-normal">
                                    (เว้นว่าง = เป็นสำนัก/คณะระดับบนสุด)
                                </span>
                            </Label>
                            <DepartmentPicker
                                value={form.parent}
                                onChange={(d) => setForm((f) => ({ ...f, parent: d }))}
                                excludeId={form.id}
                                placeholder={
                                    form.id
                                        ? "ค้นหาเฉพาะเมื่อต้องการย้ายหน่วยงานแม่"
                                        : "พิมพ์รหัสหรือชื่อหน่วยงาน"
                                }
                            />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, active: e.target.checked }))
                                }
                                className="size-4"
                            />
                            เปิดใช้งาน
                        </label>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => void submitForm()} disabled={saving}>
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            บันทึก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบหน่วยงาน</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting && (
                                <>
                                    ต้องการลบ <b>{deleting.name}</b> ({deleting.code}) หรือไม่?
                                    {deleting.counts.users +
                                        deleting.counts.tickets +
                                        deleting.counts.assets +
                                        deleting.counts.children >
                                        0 && (
                                        <>
                                            {" "}
                                            หน่วยงานนี้มีผู้ใช้ {deleting.counts.users} คน · Ticket{" "}
                                            {deleting.counts.tickets} ใบ · ครุภัณฑ์{" "}
                                            {deleting.counts.assets} รายการ · หน่วยงานย่อย{" "}
                                            {deleting.counts.children} หน่วย อ้างอยู่
                                            <b> ระบบจะปิดใช้งานแทนการลบ</b> เพื่อรักษาประวัติเดิม
                                        </>
                                    )}
                                </>
                            )}
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

/// ช่องค้นหาหน่วยงาน — รูปแบบเดียวกับช่องค้นหาผู้แจ้งในฟอร์มแจ้งปัญหา
function DepartmentPicker({
    value,
    onChange,
    excludeId,
    placeholder,
}: {
    value: DepartmentRow | null
    onChange: (d: DepartmentRow | null) => void
    excludeId?: string | null
    placeholder: string
}) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<DepartmentRow[]>([])

    // ล้าง/ค้นหาใน callback ของ timer — ไม่ setState ตรงๆ ในตัว effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length < 2) {
                setResults([])
                return
            }
            const res = await fetch(`/api/departments?q=${encodeURIComponent(query)}`)
            if (res.ok) {
                const data = (await res.json()) as DepartmentListResponse
                setResults(data.departments.filter((d) => d.id !== excludeId))
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [query, excludeId])

    if (value) {
        return (
            <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                    <span className="font-mono text-xs">{value.code}</span> · {value.name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                    <X className="size-4" />
                </Button>
            </div>
        )
    }

    return (
        <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="pl-9"
            />
            {results.length > 0 && (
                <div className="bg-popover absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                    {results.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                            onClick={() => {
                                onChange(d)
                                setQuery("")
                                setResults([])
                            }}
                        >
                            <span className="font-mono text-xs">{d.code}</span> · {d.name}
                            {d.ancestors.length > 0 && (
                                <span className="text-muted-foreground block text-xs">
                                    {departmentPath(d)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
