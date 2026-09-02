"use client"

// การ์ด "กฎการทำงานของ Ticket" ในหน้าตั้งค่า SLA
// อ้างอิง F3.6 (บังคับบันทึก Time Log ก่อนปิดงาน) และ F2.7 (มอบหมายอัตโนมัติ)
//
// วางไว้ที่หน้านี้เพราะทั้งสองกฎเป็นเงื่อนไขของ "การเดินงาน Ticket" ชุดเดียวกับกำหนดเวลา SLA
// และหน้านี้จำกัดสิทธิ์ไว้ที่ admin อยู่แล้ว (api/settings ตรวจซ้ำอีกชั้น)

import { useCallback, useEffect, useState } from "react"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { readError } from "@/lib/ticket-types"
import type { AppSettingRow } from "@/lib/worklog-types"

/// ข้อความอธิบายที่อ่านรู้เรื่องกว่าค่า `description` ในฐานข้อมูล
const HINTS: Record<string, string> = {
    "ticket.require_worklog_on_resolve":
        "เจ้าหน้าที่ต้องกรอกจำนวนชั่วโมงที่ใช้ก่อนเปลี่ยนสถานะเป็น “แก้ไขเสร็จ” — ใบที่เคยลงเวลาไว้แล้วระหว่างทำงานไม่ต้องกรอกซ้ำ",
    "ticket.auto_assign":
        "เมื่อมี Ticket ใหม่ ระบบจะมอบหมายให้เจ้าหน้าที่ประจำหมวดหมู่บริการนั้นโดยอัตโนมัติ",
}

const TITLES: Record<string, string> = {
    "ticket.require_worklog_on_resolve": "บังคับบันทึกเวลาทำงานก่อนปิดงาน",
    "ticket.auto_assign": "มอบหมายเจ้าหน้าที่อัตโนมัติตามหมวดหมู่",
}

export default function TicketRulesCard() {
    const [settings, setSettings] = useState<AppSettingRow[]>([])
    const [loading, setLoading] = useState(true)
    const [savingKey, setSavingKey] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/settings")
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดค่าตั้งค่าระบบได้"))
                return
            }
            setSettings(((await res.json()) as { settings: AppSettingRow[] }).settings)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    /// สลับค่าแล้วบันทึกทันที — อัปเดตหน้าจอก่อนเพื่อให้สวิตช์ตอบสนองไว แล้วย้อนกลับถ้าพลาด
    const toggle = async (row: AppSettingRow) => {
        const next = !row.value
        setSavingKey(row.key)
        setSettings((list) => list.map((s) => (s.key === row.key ? { ...s, value: next } : s)))
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings: [{ key: row.key, value: next }] }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกค่าตั้งค่าไม่สำเร็จ"))
                setSettings((list) =>
                    list.map((s) => (s.key === row.key ? { ...s, value: row.value } : s))
                )
                return
            }
            toast.success(next ? "เปิดใช้งานกฎนี้แล้ว" : "ปิดกฎนี้แล้ว")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
            setSettings((list) =>
                list.map((s) => (s.key === row.key ? { ...s, value: row.value } : s))
            )
        } finally {
            setSavingKey(null)
        }
    }

    return (
        <Card>
            <CardHeader className="pb-0">
                <p className="flex items-center gap-2 font-medium">
                    <SlidersHorizontal className="text-muted-foreground size-4" />
                    กฎการทำงานของ Ticket
                </p>
                <p className="text-muted-foreground text-sm">
                    มีผลทั้งระบบทันทีที่บันทึก — ไม่กระทบใบที่ปิดไปแล้ว
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <Skeleton className="h-20 w-full" />
                ) : (
                    settings.map((s) => (
                        <div key={s.key} className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{TITLES[s.key] ?? s.key}</p>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {HINTS[s.key] ?? s.description ?? ""}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {savingKey === s.key && (
                                    <Loader2 className="text-muted-foreground size-4 animate-spin" />
                                )}
                                <Switch
                                    checked={s.value}
                                    disabled={savingKey !== null}
                                    onCheckedChange={() => void toggle(s)}
                                    aria-label={TITLES[s.key] ?? s.key}
                                />
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
