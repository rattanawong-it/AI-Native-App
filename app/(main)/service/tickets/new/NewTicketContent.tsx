"use client"

// ฟอร์มแจ้งปัญหา / คำขอบริการใหม่
// อ้างอิง F1.1 (ฟอร์ม), F1.10 (แจ้งแทนผู้อื่น + ระบุช่องทาง), F2.2 (Priority realtime)

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Flag, Loader2, Send, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { PriorityBadge } from "@/components/ticket/ticket-badges"
import {
    calculatePriority,
    IMPACT_LABEL,
    URGENCY_LABEL,
    type Impact,
    type Urgency,
} from "@/lib/priority"
import { TICKET_CHANNELS, TICKET_CHANNEL_LABEL } from "@/lib/ticket-workflow"
import { readError, type Category, type DirectoryAgent } from "@/lib/ticket-types"

/// เรียงระดับจากต่ำ → สูง ให้ตรงกับปุ่มเลือกในไฟล์ดีไซน์
/// (lib/priority เก็บเรียงจากสูง → ต่ำ จึงกลับด้านเฉพาะตอนแสดงผล)
const LEVELS_ASC = ["low", "medium", "high"] as const

export default function NewTicketContent() {
    const router = useRouter()
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isStaff = roles.some((r) => ["agent", "manager", "admin"].includes(r))

    const [categories, setCategories] = useState<Category[]>([])
    const [submitting, setSubmitting] = useState(false)

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [categoryId, setCategoryId] = useState("")
    const [impact, setImpact] = useState<Impact>("medium")
    const [urgency, setUrgency] = useState<Urgency>("medium")
    const [channel, setChannel] = useState<string>("web")

    // F1.10 — แจ้งแทนผู้อื่น (เจ้าหน้าที่เท่านั้น)
    const [onBehalf, setOnBehalf] = useState(false)
    const [userQuery, setUserQuery] = useState("")
    const [userResults, setUserResults] = useState<DirectoryAgent[]>([])
    const [requester, setRequester] = useState<DirectoryAgent | null>(null)

    // F2.2 — Priority คำนวณสดจาก Impact × Urgency ทุกครั้งที่เลือก
    const priority = useMemo(() => calculatePriority(impact, urgency), [impact, urgency])

    useEffect(() => {
        void (async () => {
            const res = await fetch("/api/categories")
            if (!res.ok) {
                toast.error("ไม่สามารถโหลดหมวดหมู่บริการได้")
                return
            }
            const data = (await res.json()) as { categories: Category[] }
            setCategories(data.categories)
        })()
    }, [])

    // ค้นหาผู้ใช้สำหรับแจ้งแทน — หน่วง 350ms เหมือนช่องค้นหาอื่น
    useEffect(() => {
        if (!onBehalf || userQuery.trim().length < 2) {
            setUserResults([])
            return
        }
        const timer = setTimeout(async () => {
            const res = await fetch(`/api/directory?scope=users&q=${encodeURIComponent(userQuery)}`)
            if (res.ok) {
                const data = (await res.json()) as { users: DirectoryAgent[] }
                setUserResults(data.users)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [onBehalf, userQuery])

    /// หมวดหมู่จัดกลุ่มเป็นหมวดหลัก → หมวดย่อย ให้เลือกง่าย
    const grouped = useMemo(() => {
        const parents = categories.filter((c) => !c.parentId)
        return parents.map((p) => ({
            parent: p,
            children: categories.filter((c) => c.parentId === p.id),
        }))
    }, [categories])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (title.trim().length < 5) return toast.error("กรุณากรอกหัวข้ออย่างน้อย 5 ตัวอักษร")
        if (description.trim().length < 10)
            return toast.error("กรุณาอธิบายปัญหาอย่างน้อย 10 ตัวอักษร")
        if (!categoryId) return toast.error("กรุณาเลือกหมวดหมู่บริการ")
        if (onBehalf && !requester) return toast.error("กรุณาเลือกผู้แจ้งที่ต้องการบันทึกแทน")

        setSubmitting(true)
        try {
            const res = await fetch("/api/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    categoryId,
                    impact,
                    urgency,
                    channel: isStaff ? channel : "web",
                    requesterId: onBehalf ? requester?.id : undefined,
                }),
            })

            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึก Ticket ได้"))
                return
            }

            const data = (await res.json()) as { ticket: { id: string; ticketNo: string } }
            toast.success(`บันทึกเรียบร้อย — เลขที่ ${data.ticket.ticketNo}`)
            router.push(`/service/tickets/${data.ticket.id}`)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="max-w-3xl space-y-6">
            <Link
                href="/service/tickets"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
                <ChevronLeft className="size-4" />
                กลับไป Ticket ทั้งหมด
            </Link>

            <div>
                <h1 className="text-2xl font-semibold tracking-tight">แจ้งปัญหา / คำขอบริการใหม่</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    กรอกรายละเอียด ทีมศูนย์ไอทีจะติดต่อกลับตาม SLA ที่กำหนด
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardContent className="space-y-5">
                        {/* แจ้งแทนผู้อื่น (F1.10) */}
                        {isStaff && (
                            <div className="bg-accent/60 space-y-3 rounded-lg p-4">
                                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                                    <input
                                        type="checkbox"
                                        checked={onBehalf}
                                        onChange={(e) => {
                                            setOnBehalf(e.target.checked)
                                            if (!e.target.checked) {
                                                setRequester(null)
                                                setUserQuery("")
                                                setChannel("web")
                                            }
                                        }}
                                        className="size-4"
                                    />
                                    บันทึกแทนผู้แจ้ง (รับเรื่องทางโทรศัพท์ อีเมล หรือติดต่อด้วยตนเอง)
                                </label>

                                {onBehalf && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <Label className="mb-1.5">ผู้แจ้ง</Label>
                                            {requester ? (
                                                <div className="border-input flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                                                    <span className="truncate text-sm">
                                                        {requester.name}
                                                        <span className="text-muted-foreground">
                                                            {" "}
                                                            · {requester.email}
                                                        </span>
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setRequester(null)}
                                                    >
                                                        เปลี่ยน
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <UserSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                                    <Input
                                                        value={userQuery}
                                                        onChange={(e) => setUserQuery(e.target.value)}
                                                        placeholder="พิมพ์ชื่อ อีเมล หรือรหัสบุคลากร"
                                                        className="pl-9"
                                                    />
                                                    {userResults.length > 0 && (
                                                        <div className="bg-popover absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                                                            {userResults.map((u) => (
                                                                <button
                                                                    key={u.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setRequester(u)
                                                                        setUserResults([])
                                                                    }}
                                                                    className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                                                                >
                                                                    <span className="font-medium">{u.name}</span>
                                                                    <span className="text-muted-foreground block text-xs">
                                                                        {u.email}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="mb-1.5">ช่องทางที่รับแจ้ง</Label>
                                            <select
                                                value={channel}
                                                onChange={(e) => setChannel(e.target.value)}
                                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                            >
                                                {TICKET_CHANNELS.map((c) => (
                                                    <option key={c} value={c}>
                                                        {TICKET_CHANNEL_LABEL[c]}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <Label htmlFor="title" className="mb-1.5">
                                หัวข้อ
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="เช่น เข้าเว็บไซต์คณะไม่ได้"
                                maxLength={200}
                            />
                        </div>

                        <div>
                            <Label htmlFor="description" className="mb-1.5">
                                รายละเอียด
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="อธิบายปัญหาที่พบ อาการ และเวลาที่เกิดขึ้น..."
                                rows={6}
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                {description.length} / 10000 ตัวอักษร
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="category" className="mb-1.5">
                                หมวดหมู่บริการ
                            </Label>
                            <select
                                id="category"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">— เลือกหมวดหมู่ —</option>
                                {grouped.map(({ parent, children }) =>
                                    children.length > 0 ? (
                                        <optgroup key={parent.id} label={parent.name}>
                                            {children.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ) : (
                                        <option key={parent.id} value={parent.id}>
                                            {parent.name}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {/* F2.2 — Impact × Urgency พร้อม Priority แบบ realtime */}
                        <div className="bg-accent/60 space-y-4 rounded-lg p-4">
                            <p className="text-sm font-medium">ระดับผลกระทบและความเร่งด่วน</p>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <LevelPicker
                                    label="ผลกระทบ (Impact)"
                                    hint="กระทบผู้ใช้กี่คน / งานหยุดชะงักแค่ไหน"
                                    value={impact}
                                    onChange={(v) => setImpact(v as Impact)}
                                    labels={IMPACT_LABEL}
                                />
                                <LevelPicker
                                    label="ความเร่งด่วน (Urgency)"
                                    hint="รอได้นานแค่ไหนก่อนเกิดความเสียหาย"
                                    value={urgency}
                                    onChange={(v) => setUrgency(v as Urgency)}
                                    labels={URGENCY_LABEL}
                                />
                            </div>

                            <div className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3">
                                <Flag className="text-muted-foreground size-4" />
                                <span className="text-muted-foreground text-sm">
                                    ระดับความสำคัญที่คำนวณได้
                                </span>
                                <PriorityBadge priority={priority} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" asChild>
                                <Link href="/service/tickets">ยกเลิก</Link>
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Send className="size-4" />
                                )}
                                {submitting ? "กำลังส่ง..." : "ส่งคำขอ"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>

            <p className="text-muted-foreground text-xs">
                หมายเหตุ: การแนบไฟล์ (F1.7) จะเปิดใช้งานในเฟสถัดไป ระหว่างนี้หากมีภาพหน้าจอประกอบ
                กรุณาแจ้งเจ้าหน้าที่ผ่านช่องความคิดเห็นในหน้ารายละเอียด Ticket
            </p>
        </div>
    )
}

/// ปุ่มเลือกระดับ 3 ขั้น (ต่ำ / กลาง / สูง) — ตรงกับ picker ในไฟล์ดีไซน์
function LevelPicker({
    label,
    hint,
    value,
    onChange,
    labels,
}: {
    label: string
    hint: string
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
            <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
        </div>
    )
}
