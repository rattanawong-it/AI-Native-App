"use client"

// หน้าตั้งค่าปฏิทินทำการ — เวลาทำการรายสัปดาห์ (F4.2) และวันหยุดราชการ (F4.3)
// ค่าทั้งสองส่วนนี้คือฐานที่ lib/business-hours.ts ใช้คำนวณกำหนดเวลา SLA ทุกใบ

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    CalendarDays,
    Clock,
    Download,
    Loader2,
    Plus,
    RefreshCw,
    Repeat,
    Save,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    formatThaiDate,
    DAY_NAMES_TH,
    type BusinessHourRow,
    type HolidayRow,
} from "@/lib/ticket-types"

/// วันหยุดราชการที่วันที่ตายตัวทุกปี — ใช้เติมกล่องนำเข้าให้ผู้ดูแลแก้ต่อได้
/// (ชุดเดียวกับ FIXED_HOLIDAYS ใน prisma/seed.ts)
const FIXED_HOLIDAY_TEMPLATE = [
    "01-01 วันขึ้นปีใหม่",
    "04-06 วันจักรี",
    "04-13 วันสงกรานต์",
    "04-14 วันสงกรานต์",
    "04-15 วันสงกรานต์",
    "05-01 วันแรงงานแห่งชาติ",
    "05-04 วันฉัตรมงคล",
    "06-03 วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี",
    "07-28 วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว",
    "08-12 วันแม่แห่งชาติ",
    "10-13 วันนวมินทรมหาราช",
    "10-23 วันปิยมหาราช",
    "12-05 วันพ่อแห่งชาติ / วันชาติ",
    "12-10 วันรัฐธรรมนูญ",
    "12-31 วันสิ้นปี",
].join("\n")

/// "2026" → "2569" (พุทธศักราช)
function toBuddhistYear(year: number): number {
    return year + 543
}

interface ParsedHoliday {
    date: string
    name: string
    isRecurring: boolean
}

/// แปลงข้อความในกล่องนำเข้าเป็นรายการวันหยุด
///
/// รับได้ทั้ง "MM-DD ชื่อวัน" (ใช้ปีที่เลือก) และ "YYYY-MM-DD ชื่อวัน"
/// บรรทัดว่างและบรรทัดที่ขึ้นต้นด้วย # จะถูกข้าม
function parseHolidayLines(
    text: string,
    year: number,
    isRecurring: boolean
): { items: ParsedHoliday[]; errors: string[] } {
    const items: ParsedHoliday[] = []
    const errors: string[] = []

    text.split("\n").forEach((raw, index) => {
        const line = raw.trim()
        if (line === "" || line.startsWith("#")) return

        const match = line.match(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})\s+(.+)$/)
        if (!match) {
            errors.push(`บรรทัดที่ ${index + 1}: รูปแบบไม่ถูกต้อง`)
            return
        }

        const [, datePart, name] = match
        const date = datePart.length === 5 ? `${year}-${datePart}` : datePart
        if (Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
            errors.push(`บรรทัดที่ ${index + 1}: วันที่ไม่ถูกต้อง`)
            return
        }
        items.push({ date, name: name.trim(), isRecurring })
    })

    return { items, errors }
}

export default function CalendarContent() {
    const currentYear = new Date().getFullYear()

    const [hours, setHours] = useState<BusinessHourRow[]>([])
    const [holidays, setHolidays] = useState<HolidayRow[]>([])
    const [year, setYear] = useState(currentYear)
    const [loadingHours, setLoadingHours] = useState(true)
    const [loadingHolidays, setLoadingHolidays] = useState(true)
    const [busy, setBusy] = useState(false)

    const [holidayForm, setHolidayForm] = useState<{ open: boolean; date: string; name: string; isRecurring: boolean }>({
        open: false,
        date: "",
        name: "",
        isRecurring: false,
    })
    const [importForm, setImportForm] = useState<{ open: boolean; text: string; isRecurring: boolean; overwrite: boolean }>({
        open: false,
        text: "",
        isRecurring: false,
        overwrite: false,
    })
    const [deleting, setDeleting] = useState<HolidayRow | null>(null)

    const loadHours = useCallback(async () => {
        setLoadingHours(true)
        try {
            const res = await fetch("/api/business-hours")
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดเวลาทำการได้"))
                return
            }
            const data = (await res.json()) as { hours: BusinessHourRow[] }
            setHours(data.hours)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoadingHours(false)
        }
    }, [])

    const loadHolidays = useCallback(async (targetYear: number) => {
        setLoadingHolidays(true)
        try {
            const res = await fetch(`/api/holidays?year=${targetYear}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดวันหยุดได้"))
                return
            }
            const data = (await res.json()) as { holidays: HolidayRow[] }
            setHolidays(data.holidays)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoadingHolidays(false)
        }
    }, [])

    useEffect(() => {
        void loadHours()
    }, [loadHours])

    useEffect(() => {
        void loadHolidays(year)
    }, [loadHolidays, year])

    /// ชั่วโมงทำการต่อสัปดาห์ — ใช้บอกผู้ดูแลว่าการแก้มีผลกับ SLA แค่ไหน
    const weeklyHours = useMemo(() => {
        const total = hours.reduce((sum, h) => {
            if (!h.isWorkingDay) return sum
            const [sh, sm] = h.startTime.split(":").map(Number)
            const [eh, em] = h.endTime.split(":").map(Number)
            const minutes = eh * 60 + em - (sh * 60 + sm)
            return sum + Math.max(0, minutes)
        }, 0)
        return Math.round((total / 60) * 10) / 10
    }, [hours])

    const setHour = (dayOfWeek: number, patch: Partial<BusinessHourRow>) => {
        setHours((prev) => prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)))
    }

    const saveHours = async () => {
        const broken = hours.find(
            (h) => h.isWorkingDay && h.endTime <= h.startTime
        )
        if (broken) {
            return toast.error(`วัน${DAY_NAMES_TH[broken.dayOfWeek]}: เวลาสิ้นสุดต้องหลังเวลาเริ่ม`)
        }

        setBusy(true)
        try {
            const res = await fetch("/api/business-hours", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hours: hours.map((h) => ({
                        dayOfWeek: h.dayOfWeek,
                        startTime: h.startTime,
                        endTime: h.endTime,
                        isWorkingDay: h.isWorkingDay,
                    })),
                }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกเวลาทำการได้"))
                return
            }
            const data = (await res.json()) as { hours: BusinessHourRow[] }
            setHours(data.hours)
            toast.success("บันทึกเวลาทำการเรียบร้อย — มีผลกับ Ticket ที่แจ้งหลังจากนี้")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const submitHoliday = async () => {
        if (!holidayForm.date) return toast.error("กรุณาเลือกวันที่")
        if (holidayForm.name.trim().length < 2) return toast.error("กรุณากรอกชื่อวันหยุด")

        setBusy(true)
        try {
            const res = await fetch("/api/holidays", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: holidayForm.date,
                    name: holidayForm.name.trim(),
                    isRecurring: holidayForm.isRecurring,
                }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกวันหยุดได้"))
                return
            }
            toast.success("เพิ่มวันหยุดเรียบร้อย")
            setHolidayForm({ open: false, date: "", name: "", isRecurring: false })
            await loadHolidays(year)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const submitImport = async () => {
        const { items, errors } = parseHolidayLines(importForm.text, year, importForm.isRecurring)
        if (errors.length > 0) return toast.error(errors[0])
        if (items.length === 0) return toast.error("ไม่มีรายการวันหยุดที่จะนำเข้า")

        setBusy(true)
        try {
            const res = await fetch("/api/holidays/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items, overwrite: importForm.overwrite }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "นำเข้าวันหยุดไม่สำเร็จ"))
                return
            }
            const data = (await res.json()) as {
                created: number
                updated: number
                skipped: number
            }
            toast.success(
                `นำเข้าเรียบร้อย — เพิ่มใหม่ ${data.created} · แก้ไข ${data.updated} · ข้ามที่มีอยู่แล้ว ${data.skipped}`
            )
            setImportForm((f) => ({ ...f, open: false }))
            await loadHolidays(year)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleting) return
        const res = await fetch(`/api/holidays/${deleting.id}`, { method: "DELETE" })
        if (!res.ok) {
            toast.error(await readError(res, "ไม่สามารถลบวันหยุดได้"))
            setDeleting(null)
            return
        }
        toast.success("ลบวันหยุดเรียบร้อย")
        setDeleting(null)
        await loadHolidays(year)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">ปฏิทินทำการ</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        เวลาทำการและวันหยุดที่ใช้นับ &quot;นาทีทำการ&quot; ของ{" "}
                        <Link href="/admin/sla" className="underline underline-offset-2">
                            นโยบาย SLA
                        </Link>{" "}
                        — นอกเวลาทำการและวันหยุด นาฬิกา SLA จะหยุดเดิน
                    </p>
                </div>
            </div>

            <Tabs defaultValue="hours">
                <TabsList>
                    <TabsTrigger value="hours">
                        <Clock className="size-4" />
                        เวลาทำการ
                    </TabsTrigger>
                    <TabsTrigger value="holidays">
                        <CalendarDays className="size-4" />
                        วันหยุด
                    </TabsTrigger>
                </TabsList>

                {/* ── เวลาทำการรายสัปดาห์ (F4.2) ── */}
                <TabsContent value="hours" className="mt-4">
                    <Card className="overflow-hidden py-0">
                        <CardHeader className="bg-muted/40 flex flex-row flex-wrap items-center justify-between gap-3 border-b py-3">
                            <div>
                                <p className="font-medium">เวลาทำการรายสัปดาห์</p>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    รวม {weeklyHours} ชั่วโมงทำการต่อสัปดาห์
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => void loadHours()}
                                >
                                    <RefreshCw
                                        className={loadingHours ? "size-4 animate-spin" : "size-4"}
                                    />
                                    <span className="sr-only">รีเฟรช</span>
                                </Button>
                                <Button onClick={() => void saveHours()} disabled={busy}>
                                    {busy ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Save className="size-4" />
                                    )}
                                    บันทึก
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {loadingHours ? (
                                <Skeleton className="m-6 h-56" />
                            ) : (
                                hours.map((h, i) => (
                                    <div
                                        key={h.dayOfWeek}
                                        className={
                                            "flex flex-wrap items-center gap-4 px-6 py-3" +
                                            (i > 0 ? " border-t" : "")
                                        }
                                    >
                                        <span className="w-24 text-sm font-medium">
                                            {DAY_NAMES_TH[h.dayOfWeek]}
                                        </span>

                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                            <Switch
                                                checked={h.isWorkingDay}
                                                onCheckedChange={(v) =>
                                                    setHour(h.dayOfWeek, { isWorkingDay: v })
                                                }
                                            />
                                            <span className="text-muted-foreground w-20">
                                                {h.isWorkingDay ? "วันทำการ" : "วันหยุด"}
                                            </span>
                                        </label>

                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="time"
                                                value={h.startTime}
                                                disabled={!h.isWorkingDay}
                                                onChange={(e) =>
                                                    setHour(h.dayOfWeek, { startTime: e.target.value })
                                                }
                                                className="w-32"
                                            />
                                            <span className="text-muted-foreground text-sm">ถึง</span>
                                            <Input
                                                type="time"
                                                value={h.endTime}
                                                disabled={!h.isWorkingDay}
                                                onChange={(e) =>
                                                    setHour(h.dayOfWeek, { endTime: e.target.value })
                                                }
                                                className="w-32"
                                            />
                                        </div>

                                        {h.id === null && (
                                            <span className="text-muted-foreground text-xs">
                                                (ยังใช้ค่าเริ่มต้นของระบบ)
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── วันหยุดราชการ (F4.3) ── */}
                <TabsContent value="holidays" className="mt-4">
                    <Card className="overflow-hidden py-0">
                        <CardHeader className="bg-muted/40 flex flex-row flex-wrap items-center justify-between gap-3 border-b py-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="font-medium">วันหยุดปี</p>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                                >
                                    {[-1, 0, 1, 2].map((offset) => {
                                        const y = currentYear + offset
                                        return (
                                            <option key={y} value={y}>
                                                พ.ศ. {toBuddhistYear(y)} ({y})
                                            </option>
                                        )
                                    })}
                                </select>
                                <span className="text-muted-foreground text-xs">
                                    {holidays.length} วัน
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setImportForm({
                                            open: true,
                                            text: FIXED_HOLIDAY_TEMPLATE,
                                            isRecurring: false,
                                            overwrite: false,
                                        })
                                    }
                                >
                                    <Download className="size-4" />
                                    นำเข้าทั้งปี
                                </Button>
                                <Button
                                    onClick={() =>
                                        setHolidayForm({
                                            open: true,
                                            date: `${year}-01-01`,
                                            name: "",
                                            isRecurring: false,
                                        })
                                    }
                                >
                                    <Plus className="size-4" />
                                    เพิ่มวันหยุด
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {loadingHolidays ? (
                                <Skeleton className="m-6 h-56" />
                            ) : holidays.length === 0 ? (
                                <div className="text-muted-foreground py-14 text-center text-sm">
                                    <CalendarDays className="mx-auto mb-3 size-8 opacity-40" />
                                    ยังไม่มีวันหยุดในปีนี้
                                </div>
                            ) : (
                                holidays.map((h, i) => (
                                    <div
                                        key={h.id}
                                        className={
                                            "flex flex-wrap items-center gap-3 px-6 py-3" +
                                            (i > 0 ? " border-t" : "")
                                        }
                                    >
                                        <span className="w-40 text-sm">{formatThaiDate(h.date)}</span>
                                        <span className="min-w-[160px] flex-1 text-sm font-medium">
                                            {h.name}
                                        </span>
                                        {h.isRecurring && (
                                            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                                                <Repeat className="size-3" />
                                                หยุดทุกปี
                                            </span>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleting(h)}
                                            title="ลบ"
                                        >
                                            <Trash2 className="text-destructive size-4" />
                                            <span className="sr-only">ลบ</span>
                                        </Button>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <p className="text-muted-foreground mt-3 text-xs">
                        วันหยุดที่ติ๊ก &quot;หยุดทุกปี&quot; จะถูกใช้กับทุกปีโดยไม่ต้องเพิ่มซ้ำ ·
                        วันหยุดทางจันทรคติ (มาฆบูชา วิสาขบูชา เข้าพรรษา)
                        เปลี่ยนวันทุกปี ต้องนำเข้าใหม่ตามประกาศสำนักนายกรัฐมนตรี
                    </p>
                </TabsContent>
            </Tabs>

            {/* เพิ่มวันหยุดทีละวัน */}
            <Dialog
                open={holidayForm.open}
                onOpenChange={(o) => setHolidayForm((f) => ({ ...f, open: o }))}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>เพิ่มวันหยุด</DialogTitle>
                        <DialogDescription>
                            วันที่เพิ่มจะถูกข้ามทันทีในการคำนวณกำหนดเวลา SLA ของ Ticket ที่แจ้งหลังจากนี้
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5">วันที่</Label>
                            <Input
                                type="date"
                                value={holidayForm.date}
                                onChange={(e) =>
                                    setHolidayForm((f) => ({ ...f, date: e.target.value }))
                                }
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5">ชื่อวันหยุด</Label>
                            <Input
                                value={holidayForm.name}
                                onChange={(e) =>
                                    setHolidayForm((f) => ({ ...f, name: e.target.value }))
                                }
                                placeholder="เช่น วันหยุดชดเชยวันสงกรานต์"
                            />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={holidayForm.isRecurring}
                                onChange={(e) =>
                                    setHolidayForm((f) => ({ ...f, isRecurring: e.target.checked }))
                                }
                                className="size-4"
                            />
                            หยุดวันเดิมนี้ทุกปี (วันที่ตายตัว)
                        </label>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setHolidayForm((f) => ({ ...f, open: false }))}
                        >
                            ยกเลิก
                        </Button>
                        <Button onClick={() => void submitHoliday()} disabled={busy}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            บันทึก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* นำเข้าวันหยุดทั้งปี */}
            <Dialog
                open={importForm.open}
                onOpenChange={(o) => setImportForm((f) => ({ ...f, open: o }))}
            >
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>นำเข้าวันหยุด พ.ศ. {toBuddhistYear(year)}</DialogTitle>
                        <DialogDescription>
                            หนึ่งบรรทัดต่อหนึ่งวัน — &quot;MM-DD ชื่อวัน&quot; (ใช้ปีที่เลือก) หรือ
                            &quot;YYYY-MM-DD ชื่อวัน&quot; · บรรทัดที่ขึ้นต้นด้วย # จะถูกข้าม
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            value={importForm.text}
                            onChange={(e) => setImportForm((f) => ({ ...f, text: e.target.value }))}
                            rows={14}
                            className="font-mono text-xs"
                        />

                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={importForm.isRecurring}
                                onChange={(e) =>
                                    setImportForm((f) => ({ ...f, isRecurring: e.target.checked }))
                                }
                                className="size-4"
                            />
                            ทั้งชุดนี้เป็นวันหยุดที่ตายตัวทุกปี
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={importForm.overwrite}
                                onChange={(e) =>
                                    setImportForm((f) => ({ ...f, overwrite: e.target.checked }))
                                }
                                className="size-4"
                            />
                            ทับชื่อของวันที่ที่มีอยู่แล้ว (ไม่ติ๊ก = ข้ามวันที่ซ้ำ)
                        </label>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setImportForm((f) => ({ ...f, open: false }))}
                        >
                            ยกเลิก
                        </Button>
                        <Button onClick={() => void submitImport()} disabled={busy}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            นำเข้า
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ยืนยันการลบวันหยุด */}
            <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบ &quot;{deleting?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting && formatThaiDate(deleting.date)} จะกลับมาเป็นวันทำการ ·
                            Ticket ที่คำนวณกำหนดเวลาไว้แล้วไม่เปลี่ยนตาม
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
