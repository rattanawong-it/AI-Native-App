"use client"

// หน้ารายการคำขออนุมัติ — ทั้งหมด / ของฉัน / รออนุมัติของฉัน
// อ้างอิง F7.8, F7.9, F7.11, F7.12

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    ChevronLeft,
    ChevronRight,
    FileCheck2,
    Plus,
    RefreshCw,
    Search,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ApprovalStatusBadge, ApprovalTypeBadge } from "@/components/approval/approval-badges"
import {
    APPROVAL_STATUSES,
    APPROVAL_STATUS_LABEL,
    APPROVAL_TYPES,
    APPROVAL_TYPE_LABEL,
} from "@/lib/approval-workflow"
import {
    APPROVAL_SORT_OPTIONS,
    formatAmount,
    type ApprovalListResponse,
    type ApprovalRow,
} from "@/lib/approval-types"
import { readError } from "@/lib/ticket-types"

const PAGE_SIZE = 20
const ANY_TYPE = "__all__"

const SCOPE_TABS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "mine", label: "คำขอของฉัน" },
    { key: "to-approve", label: "รออนุมัติของฉัน" },
]

const STATUS_TABS = [
    { key: "all", label: "ทุกสถานะ" },
    ...APPROVAL_STATUSES.map((s) => ({ key: s, label: APPROVAL_STATUS_LABEL[s] })),
]

function thaiDate(iso: string): string {
    return new Date(iso).toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

/// ความคืบหน้าของการไล่ขั้น เช่น "2/3" — บอกได้ทันทีว่าใบนี้เดินไปถึงไหน (F7.10)
function stepProgress(request: ApprovalRow): string {
    const decided = request.steps.filter((s) => s.status !== "pending").length
    return `${decided}/${request.steps.length}`
}

export default function RequestContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canApprove = roles.some((r) => ["manager", "admin"].includes(r))

    const [requests, setRequests] = useState<ApprovalRow[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [scope, setScope] = useState("all")
    const [status, setStatus] = useState("all")
    const [type, setType] = useState(ANY_TYPE)
    const [sort, setSort] = useState("latest")
    const [page, setPage] = useState(1)

    // ผู้ที่ไม่มีสิทธิ์อนุมัติไม่ต้องมีแท็บ "รออนุมัติของฉัน" ให้กดแล้วเจอรายการว่างเปล่า
    const scopeTabs = canApprove ? SCOPE_TABS : SCOPE_TABS.filter((t) => t.key !== "to-approve")

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [search])

    const queryString = useMemo(() => {
        const params = new URLSearchParams()
        if (debouncedSearch) params.set("q", debouncedSearch)
        if (scope !== "all") params.set("scope", scope)
        if (status !== "all") params.set("status", status)
        if (type !== ANY_TYPE) params.set("type", type)
        params.set("sort", sort)
        params.set("page", String(page))
        params.set("pageSize", String(PAGE_SIZE))
        return params.toString()
    }, [debouncedSearch, scope, status, type, sort, page])

    const fetchRequests = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/approvals?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายการคำขอได้"))
                return
            }
            const data = (await res.json()) as ApprovalListResponse
            setRequests(data.requests)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [queryString])

    useEffect(() => {
        void fetchRequests()
    }, [fetchRequests])

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold">
                        <FileCheck2 className="size-6 text-primary" aria-hidden />
                        คำขออนุมัติ
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        คำขอจัดซื้อ เบิกวัสดุ และงบประมาณ — ไล่อนุมัติทีละขั้นตามลำดับที่กำหนด
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchRequests()}>
                        <RefreshCw className="size-4" aria-hidden />
                        รีเฟรช
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/management/requests/new">
                            <Plus className="size-4" aria-hidden />
                            สร้างคำขอ
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="relative min-w-56 flex-1">
                        <Search
                            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="ค้นหาเลขที่คำขอหรือเรื่อง"
                            className="pl-9"
                            aria-label="ค้นหาคำขอ"
                        />
                    </div>

                    <Select
                        value={type}
                        onValueChange={(v) => {
                            setType(v)
                            setPage(1)
                        }}
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="ทุกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY_TYPE}>ทุกประเภท</SelectItem>
                            {APPROVAL_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {APPROVAL_TYPE_LABEL[t]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={sort} onValueChange={setSort}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {APPROVAL_SORT_OPTIONS.map((o) => (
                                <SelectItem key={o.key} value={o.key}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex w-full flex-wrap gap-1.5">
                        {scopeTabs.map((tab) => (
                            <Button
                                key={tab.key}
                                variant={scope === tab.key ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setScope(tab.key)
                                    setPage(1)
                                }}
                            >
                                {tab.label}
                            </Button>
                        ))}

                        <span className="mx-1 w-px self-stretch bg-border" aria-hidden />

                        {STATUS_TABS.map((tab) => (
                            <Button
                                key={tab.key}
                                variant={status === tab.key ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => {
                                    setStatus(tab.key)
                                    setPage(1)
                                }}
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                        <FileCheck2 className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ไม่พบคำขอตามเงื่อนไขนี้</p>
                        <p className="text-sm text-muted-foreground">
                            ลองเปลี่ยนตัวกรอง หรือสร้างคำขอใหม่
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        {/* ตารางกว้างกว่าจอมือถือ — ให้เลื่อนในกรอบตัวเอง ไม่ดันทั้งหน้า (NFR5) */}
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>เลขที่</TableHead>
                                        <TableHead>เรื่อง</TableHead>
                                        <TableHead>ประเภท</TableHead>
                                        <TableHead>จำนวนเงิน</TableHead>
                                        <TableHead>ผู้ขอ</TableHead>
                                        <TableHead>สถานะ</TableHead>
                                        <TableHead>ขั้น</TableHead>
                                        <TableHead>ยื่นเมื่อ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                                <Link
                                                    href={`/management/requests/${request.id}`}
                                                    className="hover:text-primary hover:underline"
                                                >
                                                    {request.requestNo}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/management/requests/${request.id}`}
                                                    className="font-medium hover:text-primary hover:underline"
                                                >
                                                    {request.title}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <ApprovalTypeBadge type={request.type} />
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {formatAmount(request.amount)}
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {request.requester.name}
                                            </TableCell>
                                            <TableCell>
                                                <ApprovalStatusBadge status={request.status} />
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {stepProgress(request)}
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {thaiDate(request.createdAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && requests.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        ทั้งหมด {total} รายการ · หน้า {page} จาก {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="size-4" aria-hidden />
                            ก่อนหน้า
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            ถัดไป
                            <ChevronRight className="size-4" aria-hidden />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
