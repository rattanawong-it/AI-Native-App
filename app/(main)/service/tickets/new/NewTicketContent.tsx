"use client"

// ฟอร์มแจ้งปัญหา / คำขอบริการใหม่
// อ้างอิง F1.1 (ฟอร์ม), F1.10 (แจ้งแทนผู้อื่น + ระบุช่องทาง), F2.2 (Priority realtime)

import { rolesAreStaff } from "@/lib/roles"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, ChevronLeft, Flag, Link2, Loader2, Send, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { authClient, useSession } from "@/lib/auth-client"
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
import { TICKET_CHANNELS, TICKET_CHANNEL_LABEL, DEPARTMENT_CHANNEL } from "@/lib/ticket-workflow"
import {
    DIRECTORY_SCOPE,
    readError,
    type Category,
    type DirectoryAgent,
    type DirectoryStatus,
    type GoogleDirectoryResponse,
} from "@/lib/ticket-types"
import {
    departmentPath,
    type DepartmentListResponse,
    type DepartmentRow,
} from "@/lib/department-types"

/// เรียงระดับจากต่ำ → สูง ให้ตรงกับปุ่มเลือกในไฟล์ดีไซน์
/// (lib/priority เก็บเรียงจากสูง → ต่ำ จึงกลับด้านเฉพาะตอนแสดงผล)
const LEVELS_ASC = ["low", "medium", "high"] as const

/// ผู้แจ้งที่เลือกแล้ว — มีบัญชีในระบบแล้ว (ส่ง requesterId) หรือมาจาก Google Directory
/// และยังไม่มีบัญชี (ส่ง requesterEmail ให้ server ยืนยันกับ Google แล้วสร้างบัญชีให้)
type SelectedRequester =
    | { kind: "local"; id: string; name: string; email: string }
    | { kind: "google"; name: string; email: string }

type GooglePerson = GoogleDirectoryResponse["people"][number]

/// หน้านี้เองคือปลายทางหลังเชื่อมต่อ Google — ใส่ query ไว้บอกผลให้แสดง toast
const LINK_RETURN_URL = "/service/tickets/new"

export default function NewTicketContent() {
    const router = useRouter()
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isStaff = rolesAreStaff(roles)

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
    const [requester, setRequester] = useState<SelectedRequester | null>(null)

    // ค้นผู้แจ้งจาก Google Workspace Directory ของมหาวิทยาลัย (spec §19)
    const [googleResults, setGoogleResults] = useState<GooglePerson[]>([])
    const [googleStatus, setGoogleStatus] = useState<DirectoryStatus | null>(null)
    const [linking, setLinking] = useState(false)

    // ช่องทาง "ติดต่อจากหน่วยงาน" — ต้องระบุหน่วยงานต้นทางเสมอ
    const [deptQuery, setDeptQuery] = useState("")
    const [deptResults, setDeptResults] = useState<DepartmentRow[]>([])
    const [department, setDepartment] = useState<DepartmentRow | null>(null)

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

    // กลับมาจากหน้าเชื่อมต่อ Google — แจ้งผลแล้วล้าง query ออกจาก URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const result = params.get("googleLink")
        if (!result) return
        if (result === "ok") toast.success("เชื่อมต่อบัญชี Google แล้ว ค้นหาผู้แจ้งจากรายชื่อมหาวิทยาลัยได้เลย")
        else toast.error("เชื่อมต่อบัญชี Google ไม่สำเร็จ — ต้องใช้บัญชี Google อีเมลเดียวกับที่ล็อกอินอยู่")
        window.history.replaceState(null, "", LINK_RETURN_URL)
        setOnBehalf(true)
    }, [])

    // เปิดโหมดบันทึกแทนแล้ว ถามสถานะการเชื่อมต่อ Google ก่อน เพื่อโชว์ปุ่มเชื่อมต่อได้ทันที
    useEffect(() => {
        if (!onBehalf) {
            setGoogleStatus(null)
            return
        }
        void (async () => {
            const res = await fetch("/api/directory?scope=google")
            if (res.ok) setGoogleStatus(((await res.json()) as GoogleDirectoryResponse).status)
        })()
    }, [onBehalf])

    // ค้นหาผู้ใช้สำหรับแจ้งแทน — ในระบบกับ Google พร้อมกัน หน่วง 350ms เหมือนช่องค้นหาอื่น
    useEffect(() => {
        if (!onBehalf || userQuery.trim().length < 2) {
            setUserResults([])
            setGoogleResults([])
            return
        }
        const q = encodeURIComponent(userQuery)
        const timer = setTimeout(async () => {
            const [local, google] = await Promise.all([
                fetch(`/api/directory?scope=users&q=${q}`),
                fetch(`/api/directory?scope=google&q=${q}`),
            ])
            if (local.ok) {
                const data = (await local.json()) as { users: DirectoryAgent[] }
                setUserResults(data.users)
            }
            // Google ใช้ไม่ได้ก็ไม่เป็นไร ยังค้นจากในระบบได้ตามปกติ
            if (google.ok) {
                const data = (await google.json()) as GoogleDirectoryResponse
                setGoogleStatus(data.status)
                setGoogleResults(data.people)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [onBehalf, userQuery])

    /// คนจาก Google ที่อีเมลซ้ำกับผลค้นในระบบไม่ต้องโชว์ซ้ำ
    const googleExtra = useMemo(() => {
        const localEmails = new Set(userResults.map((u) => u.email.toLowerCase()))
        return googleResults.filter((p) => !localEmails.has(p.email))
    }, [userResults, googleResults])

    const pickRequester = (next: SelectedRequester) => {
        setRequester(next)
        setUserResults([])
        setGoogleResults([])
    }

    /// ขอสิทธิ์อ่านรายชื่อบุคลากรเพิ่มจากบัญชี Google ที่ผูกไว้ (ขอเฉพาะเจ้าหน้าที่ที่กดเท่านั้น)
    const connectGoogle = async () => {
        setLinking(true)
        const { error } = await authClient.linkSocial({
            provider: "google",
            scopes: [DIRECTORY_SCOPE],
            callbackURL: `${LINK_RETURN_URL}?googleLink=ok`,
            errorCallbackURL: `${LINK_RETURN_URL}?googleLink=failed`,
        })
        // สำเร็จจะถูกพาไปหน้า Google เอง — มาถึงบรรทัดนี้ได้แปลว่าเริ่มเชื่อมต่อไม่สำเร็จ
        if (error) {
            toast.error(error.message || "เริ่มเชื่อมต่อบัญชี Google ไม่สำเร็จ")
            setLinking(false)
        }
    }

    // ค้นหาหน่วยงาน — รูปแบบเดียวกับช่องค้นหาผู้แจ้งข้างบน
    useEffect(() => {
        if (channel !== DEPARTMENT_CHANNEL || deptQuery.trim().length < 2) {
            setDeptResults([])
            return
        }
        const timer = setTimeout(async () => {
            const res = await fetch(`/api/departments?q=${encodeURIComponent(deptQuery)}`)
            if (res.ok) {
                const data = (await res.json()) as DepartmentListResponse
                setDeptResults(data.departments)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [channel, deptQuery])

    // เปลี่ยนไปช่องทางอื่นแล้วต้องไม่เหลือหน่วยงานค้างติดไปกับ Ticket
    useEffect(() => {
        if (channel !== DEPARTMENT_CHANNEL) {
            setDepartment(null)
            setDeptQuery("")
        }
    }, [channel])

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
        if (isStaff && channel === DEPARTMENT_CHANNEL && !department)
            return toast.error("กรุณาเลือกหน่วยงานที่ติดต่อมา")

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
                    requesterId:
                        onBehalf && requester?.kind === "local" ? requester.id : undefined,
                    requesterEmail:
                        onBehalf && requester?.kind === "google" ? requester.email : undefined,
                    departmentId:
                        isStaff && channel === DEPARTMENT_CHANNEL ? department?.id : undefined,
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
                                                    <span className="min-w-0 text-sm">
                                                        <span className="block truncate">
                                                            {requester.name}
                                                            <span className="text-muted-foreground">
                                                                {" "}
                                                                · {requester.email}
                                                            </span>
                                                        </span>
                                                        {requester.kind === "google" && (
                                                            <span className="text-muted-foreground block text-xs">
                                                                ยังไม่มีบัญชี — ระบบจะสร้างให้เมื่อบันทึก
                                                            </span>
                                                        )}
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
                                                    {(userResults.length > 0 || googleExtra.length > 0) && (
                                                        <div className="bg-popover absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md">
                                                            {userResults.length > 0 && (
                                                                <ResultGroupLabel>ในระบบ</ResultGroupLabel>
                                                            )}
                                                            {userResults.map((u) => (
                                                                <button
                                                                    key={u.id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        pickRequester({
                                                                            kind: "local",
                                                                            id: u.id,
                                                                            name: u.name,
                                                                            email: u.email,
                                                                        })
                                                                    }
                                                                    className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                                                                >
                                                                    <span className="font-medium">{u.name}</span>
                                                                    <span className="text-muted-foreground block text-xs">
                                                                        {u.email}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                            {googleExtra.length > 0 && (
                                                                <ResultGroupLabel>
                                                                    จากรายชื่อ Google ของมหาวิทยาลัย
                                                                </ResultGroupLabel>
                                                            )}
                                                            {googleExtra.map((p) => (
                                                                <button
                                                                    key={p.email}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        pickRequester(
                                                                            p.userId
                                                                                ? {
                                                                                      kind: "local",
                                                                                      id: p.userId,
                                                                                      name: p.name,
                                                                                      email: p.email,
                                                                                  }
                                                                                : {
                                                                                      kind: "google",
                                                                                      name: p.name,
                                                                                      email: p.email,
                                                                                  }
                                                                        )
                                                                    }
                                                                    className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                                                                >
                                                                    <span className="font-medium">{p.name}</span>
                                                                    {!p.userId && (
                                                                        <span className="bg-accent text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[11px]">
                                                                            ยังไม่มีบัญชี
                                                                        </span>
                                                                    )}
                                                                    <span className="text-muted-foreground block text-xs">
                                                                        {p.email}
                                                                        {(p.position || p.department) &&
                                                                            ` · ${[p.position, p.department]
                                                                                .filter(Boolean)
                                                                                .join(" · ")}`}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!requester && (
                                                <GoogleConnectHint
                                                    status={googleStatus}
                                                    linking={linking}
                                                    onConnect={connectGoogle}
                                                />
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

                                {/* ติดต่อจากหน่วยงาน — ต้องระบุว่าหน่วยงานไหน ไม่งั้นแยกรายงานไม่ได้ */}
                                {onBehalf && channel === DEPARTMENT_CHANNEL && (
                                    <div>
                                        <Label className="mb-1.5">หน่วยงานที่ติดต่อมา</Label>
                                        {department ? (
                                            <div className="bg-background flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                                                <div className="text-sm">
                                                    <span className="font-mono text-xs">
                                                        {department.code}
                                                    </span>{" "}
                                                    · {department.name}
                                                    {department.ancestors.length > 0 && (
                                                        <span className="text-muted-foreground block text-xs">
                                                            {departmentPath(department)}
                                                        </span>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDepartment(null)}
                                                >
                                                    เปลี่ยน
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Building2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                                <Input
                                                    value={deptQuery}
                                                    onChange={(e) => setDeptQuery(e.target.value)}
                                                    placeholder="พิมพ์รหัสหรือชื่อหน่วยงาน"
                                                    className="pl-9"
                                                />
                                                {deptResults.length > 0 && (
                                                    <div className="bg-popover absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                                                        {deptResults.map((d) => (
                                                            <button
                                                                key={d.id}
                                                                type="button"
                                                                className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                                                                onClick={() => {
                                                                    setDepartment(d)
                                                                    setDeptQuery("")
                                                                    setDeptResults([])
                                                                }}
                                                            >
                                                                <span className="font-mono text-xs">
                                                                    {d.code}
                                                                </span>{" "}
                                                                · {d.name}
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
                                        )}
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

/// หัวกลุ่มใน dropdown ผลค้นหาผู้แจ้ง
function ResultGroupLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-muted-foreground bg-muted/50 px-3 py-1.5 text-[11px] font-semibold">
            {children}
        </p>
    )
}

/// แถบใต้ช่องผู้แจ้ง — บอกให้เชื่อมต่อ Google เมื่อยังค้นจากรายชื่อมหาวิทยาลัยไม่ได้ (spec §19)
function GoogleConnectHint({
    status,
    linking,
    onConnect,
}: {
    status: DirectoryStatus | null
    linking: boolean
    onConnect: () => void
}) {
    if (!status || status === "ok") return null

    if (status === "unavailable") {
        return (
            <p className="text-muted-foreground mt-1.5 text-xs">
                ค้นรายชื่อจาก Google ไม่ได้ในขณะนี้ — ยังค้นจากผู้ใช้ในระบบได้ตามปกติ
            </p>
        )
    }

    return (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">
                {status === "expired"
                    ? "การเชื่อมต่อ Google หมดอายุ"
                    : "ค้นจากรายชื่อบุคลากรใน Google ของมหาวิทยาลัยได้ด้วย"}
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={linking}
                onClick={onConnect}
            >
                {linking ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                {status === "expired" ? "เชื่อมต่อใหม่" : "เชื่อมต่อบัญชี Google"}
            </Button>
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
