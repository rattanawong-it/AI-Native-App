"use client"

// ฟอร์มสร้างคำขออนุมัติ — เนื้อคำขอ + ลำดับผู้อนุมัติ
// อ้างอิง F7.8, F7.9, F7.10, F7.11
//
// ลำดับของผู้อนุมัติในรายการคือลำดับการไล่อนุมัติจริง (ขั้น 1 → 2 → 3) จึงต้องเลื่อนขึ้นลงได้

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Send, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { APPROVAL_TYPES, APPROVAL_TYPE_LABEL, type ApprovalType } from "@/lib/approval-workflow"
import {
    approvalFormToPayload,
    EMPTY_APPROVAL_FORM,
    type ApprovalFormValues,
    type ApprovalDetailResponse,
} from "@/lib/approval-types"
import { readError } from "@/lib/ticket-types"

interface Person {
    id: string
    name: string
    role?: string | null
}

/// ผู้อนุมัติต้องมีสิทธิ์ `approval:approve` = `manager` ขึ้นไป (API ตรวจซ้ำอีกชั้นอยู่แล้ว)
function canApprove(person: Person): boolean {
    const role = person.role ?? ""
    return role.includes("manager") || role.includes("admin")
}

export default function RequestFormContent() {
    const router = useRouter()

    const [form, setForm] = useState<ApprovalFormValues>(EMPTY_APPROVAL_FORM)
    const [people, setPeople] = useState<Person[]>([])
    const [picked, setPicked] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/directory?scope=agents")
                if (!res.ok) return
                const data = (await res.json()) as { agents: Person[] }
                setPeople(data.agents.filter(canApprove))
            } catch {
                toast.error("โหลดรายชื่อผู้อนุมัติไม่สำเร็จ")
            }
        }
        void load()
    }, [])

    const nameOf = useMemo(
        () => new Map(people.map((p) => [p.id, p.name])),
        [people]
    )

    /// คนที่ยังไม่ถูกเลือก — กันไม่ให้ใส่คนเดิมซ้ำสองขั้น
    const available = people.filter((p) => !form.approverIds.includes(p.id))

    const set = <K extends keyof ApprovalFormValues>(key: K, value: ApprovalFormValues[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }))

    const addApprover = () => {
        if (!picked) return
        set("approverIds", [...form.approverIds, picked])
        setPicked("")
    }

    const removeApprover = (id: string) =>
        set(
            "approverIds",
            form.approverIds.filter((a) => a !== id)
        )

    const move = (index: number, delta: number) => {
        const next = [...form.approverIds]
        const target = index + delta
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target], next[index]]
        set("approverIds", next)
    }

    const save = async (submit: boolean) => {
        if (form.title.trim().length < 5) {
            toast.error("กรุณากรอกเรื่องอย่างน้อย 5 ตัวอักษร")
            return
        }
        if (form.approverIds.length === 0) {
            toast.error("กรุณาระบุผู้อนุมัติอย่างน้อย 1 คน")
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/approvals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(approvalFormToPayload(form, submit)),
            })

            if (!res.ok) {
                toast.error(await readError(res, "บันทึกคำขอไม่สำเร็จ"))
                return
            }

            const data = (await res.json()) as ApprovalDetailResponse
            toast.success(submit ? "ยื่นคำขอแล้ว" : "บันทึกฉบับร่างแล้ว")
            router.push(`/management/requests/${data.request.id}`)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" asChild className="-ml-2">
                    <Link href="/management/requests">
                        <ArrowLeft className="size-4" aria-hidden />
                        คำขออนุมัติ
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold">สร้างคำขออนุมัติ</h1>
                <p className="text-sm text-muted-foreground">
                    บันทึกเป็นฉบับร่างไว้ก่อนได้ — คำขอจะเข้าสู่การอนุมัติเมื่อกด &ldquo;ยื่นคำขอ&rdquo; เท่านั้น
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">รายละเอียดคำขอ</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>ประเภทคำขอ</Label>
                            <Select
                                value={form.type}
                                onValueChange={(v) => set("type", v as ApprovalType)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {APPROVAL_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {APPROVAL_TYPE_LABEL[t]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">จำนวนเงิน (บาท)</Label>
                            <Input
                                id="amount"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => set("amount", e.target.value)}
                                placeholder="เว้นว่างได้ถ้าไม่ผูกวงเงิน"
                            />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="title">เรื่อง *</Label>
                            <Input
                                id="title"
                                value={form.title}
                                onChange={(e) => set("title", e.target.value)}
                                placeholder="เช่น ขออนุมัติจัดซื้อโน้ตบุ๊กทดแทนเครื่องเดิม 3 เครื่อง"
                            />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="description">รายละเอียด</Label>
                            <Textarea
                                id="description"
                                rows={8}
                                value={form.description}
                                onChange={(e) => set("description", e.target.value)}
                                placeholder="เหตุผลความจำเป็น รายการที่ขอ ราคาต่อหน่วย และข้อมูลประกอบอื่นๆ"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">ลำดับผู้อนุมัติ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            ระบบจะส่งให้ทีละคนตามลำดับนี้ — คนถัดไปจะได้รับแจ้งเมื่อคนก่อนหน้าอนุมัติผ่านแล้ว
                        </p>

                        <div className="flex gap-2">
                            <Select value={picked} onValueChange={setPicked}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="เลือกผู้อนุมัติ" />
                                </SelectTrigger>
                                <SelectContent>
                                    {available.length === 0 ? (
                                        <SelectItem value="__empty__" disabled>
                                            ไม่มีผู้อนุมัติให้เลือกเพิ่ม
                                        </SelectItem>
                                    ) : (
                                        available.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={addApprover}
                                disabled={!picked || picked === "__empty__"}
                                aria-label="เพิ่มผู้อนุมัติ"
                            >
                                <Plus className="size-4" aria-hidden />
                            </Button>
                        </div>

                        {form.approverIds.length === 0 ? (
                            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                                ยังไม่ได้เลือกผู้อนุมัติ
                            </p>
                        ) : (
                            <ol className="space-y-2">
                                {form.approverIds.map((id, index) => (
                                    <li
                                        key={id}
                                        className="flex items-center gap-2 rounded-lg border p-2"
                                    >
                                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                            {index + 1}
                                        </span>
                                        <span className="flex-1 text-sm">
                                            {nameOf.get(id) ?? id}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            disabled={index === 0}
                                            onClick={() => move(index, -1)}
                                            aria-label="เลื่อนขึ้น"
                                        >
                                            <ArrowUp className="size-3.5" aria-hidden />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            disabled={index === form.approverIds.length - 1}
                                            onClick={() => move(index, 1)}
                                            aria-label="เลื่อนลง"
                                        >
                                            <ArrowDown className="size-3.5" aria-hidden />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 text-destructive hover:text-destructive"
                                            onClick={() => removeApprover(id)}
                                            aria-label="เอาออก"
                                        >
                                            <X className="size-3.5" aria-hidden />
                                        </Button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void save(false)} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    บันทึกฉบับร่าง
                </Button>
                <Button onClick={() => void save(true)} disabled={saving}>
                    {saving ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                        <Send className="size-4" aria-hidden />
                    )}
                    ยื่นคำขอ
                </Button>
            </div>
        </div>
    )
}
