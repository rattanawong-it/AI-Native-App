"use client"

// หน้าทะเบียนครุภัณฑ์ IT — ค้นหา ฟิลเตอร์ เพิ่ม/แก้ไข นำเข้า/ส่งออก และเตือนใกล้หมดประกัน
// อ้างอิง F7.1, F7.2, F7.3, F7.6, F7.7

import { rolesAreManager } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    BellRing,
    ChevronLeft,
    ChevronRight,
    Download,
    Loader2,
    Package,
    Plus,
    RefreshCw,
    Search,
    Upload,
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
import { AssetStatusBadge, AssetWarrantyBadge } from "@/components/asset/asset-badges"
import AssetFormDialog from "@/app/(main)/management/assets/AssetFormDialog"
import AssetImportDialog from "@/app/(main)/management/assets/AssetImportDialog"
import { ASSET_STATUSES, ASSET_STATUS_LABEL, ASSET_TYPES, ASSET_TYPE_LABEL } from "@/lib/asset-workflow"
import { ASSET_SORT_OPTIONS, type AssetListResponse, type AssetRow } from "@/lib/asset-types"
import { readError } from "@/lib/ticket-types"

const PAGE_SIZE = 20

/// ระยะเตือนของแท็บ "ใกล้หมดประกัน" — ตรงกับค่าเริ่มต้นของ API
const WARRANTY_DAYS = 90

const STATUS_TABS = [
    { key: "all", label: "ทั้งหมด" },
    ...ASSET_STATUSES.map((s) => ({ key: s, label: ASSET_STATUS_LABEL[s] })),
    { key: "warranty", label: `ใกล้หมดประกัน (${WARRANTY_DAYS} วัน)` },
]

const ANY_TYPE = "__all__"

interface Person {
    id: string
    name: string
    role?: string | null
}

interface DepartmentOption {
    id: string
    name: string
    code: string
}

/// วันที่แบบไทยสั้นๆ สำหรับตาราง (NFR4)
function thaiDate(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

export default function AssetContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canManage = rolesAreManager(roles)

    const [assets, setAssets] = useState<AssetRow[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [notifying, setNotifying] = useState(false)

    const [people, setPeople] = useState<Person[]>([])
    const [departments, setDepartments] = useState<DepartmentOption[]>([])

    const [formOpen, setFormOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [status, setStatus] = useState("all")
    const [type, setType] = useState(ANY_TYPE)
    const [sort, setSort] = useState<string>("latest")
    const [page, setPage] = useState(1)

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
        // แท็บ "ใกล้หมดประกัน" เป็นตัวกรองคนละแกนกับสถานะ จึงส่งเป็น warrantyWithinDays แทน
        if (status === "warranty") params.set("warrantyWithinDays", String(WARRANTY_DAYS))
        else if (status !== "all") params.set("status", status)
        if (type !== ANY_TYPE) params.set("type", type)
        params.set("sort", status === "warranty" ? "warranty" : sort)
        params.set("page", String(page))
        params.set("pageSize", String(PAGE_SIZE))
        return params.toString()
    }, [debouncedSearch, status, type, sort, page])

    const fetchAssets = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/assets?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายการครุภัณฑ์ได้"))
                return
            }
            const data = (await res.json()) as AssetListResponse
            setAssets(data.assets)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [queryString])

    useEffect(() => {
        void fetchAssets()
    }, [fetchAssets])

    // รายชื่อคนกับหน่วยงานเปลี่ยนไม่บ่อย — โหลดครั้งเดียวตอนเปิดหน้า
    useEffect(() => {
        const load = async () => {
            try {
                const [dirRes, deptRes] = await Promise.all([
                    fetch("/api/directory?scope=agents"),
                    fetch("/api/departments"),
                ])
                if (dirRes.ok) {
                    const data = (await dirRes.json()) as { agents: Person[] }
                    setPeople(data.agents)
                }
                if (deptRes.ok) {
                    const data = (await deptRes.json()) as { departments: DepartmentOption[] }
                    setDepartments(data.departments)
                }
            } catch {
                // dropdown ว่างไม่ใช่เรื่องคอขาดบาดตาย — หน้ารายการยังใช้งานได้ตามปกติ
            }
        }
        void load()
    }, [])

    /// ส่งแจ้งเตือนครุภัณฑ์ใกล้หมดประกันให้ผู้ครอบครองแต่ละคน (F7.6)
    const sendWarrantyNotice = async () => {
        setNotifying(true)
        try {
            const res = await fetch(`/api/assets/warranty?days=${WARRANTY_DAYS}`, {
                method: "POST",
            })
            if (!res.ok) {
                toast.error(await readError(res, "ส่งการแจ้งเตือนไม่สำเร็จ"))
                return
            }

            const data = (await res.json()) as {
                matched: number
                notified: number
                skippedNoCustodian: string[]
            }

            toast.success(`แจ้งเตือนแล้ว ${data.notified} รายการ จากทั้งหมด ${data.matched} รายการ`)
            if (data.skippedNoCustodian.length > 0) {
                toast.warning(
                    `ยังไม่มีผู้ครอบครอง ${data.skippedNoCustodian.length} รายการ: ${data.skippedNoCustodian.slice(0, 5).join(", ")}`
                )
            }
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setNotifying(false)
        }
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold">
                        <Package className="size-6 text-primary" aria-hidden />
                        ทะเบียนครุภัณฑ์ IT
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        ทรัพย์สินไอทีทั้งหมดของศูนย์ — ติดตามสถานะ ผู้ครอบครอง และวันหมดประกัน
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchAssets()}>
                        <RefreshCw className="size-4" aria-hidden />
                        รีเฟรช
                    </Button>

                    {canManage && (
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <a href={`/api/assets/export?${queryString}`}>
                                    <Download className="size-4" aria-hidden />
                                    ส่งออก CSV
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                <Upload className="size-4" aria-hidden />
                                นำเข้า CSV
                            </Button>
                            <Button size="sm" onClick={() => setFormOpen(true)}>
                                <Plus className="size-4" aria-hidden />
                                เพิ่มครุภัณฑ์
                            </Button>
                        </>
                    )}
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
                            placeholder="ค้นหารหัส ชื่อ ยี่ห้อ S/N หรือสถานที่"
                            className="pl-9"
                            aria-label="ค้นหาครุภัณฑ์"
                        />
                    </div>

                    <Select
                        value={type}
                        onValueChange={(v) => {
                            setType(v)
                            setPage(1)
                        }}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="ทุกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY_TYPE}>ทุกประเภท</SelectItem>
                            {ASSET_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {ASSET_TYPE_LABEL[t]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={sort} onValueChange={setSort}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ASSET_SORT_OPTIONS.map((o) => (
                                <SelectItem key={o.key} value={o.key}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex w-full flex-wrap gap-1.5">
                        {STATUS_TABS.map((tab) => (
                            <Button
                                key={tab.key}
                                variant={status === tab.key ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setStatus(tab.key)
                                    setPage(1)
                                }}
                            >
                                {tab.label}
                            </Button>
                        ))}

                        {canManage && status === "warranty" && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={notifying || assets.length === 0}
                                onClick={() => void sendWarrantyNotice()}
                            >
                                {notifying ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                ) : (
                                    <BellRing className="size-4" aria-hidden />
                                )}
                                ส่งแจ้งเตือนผู้ครอบครอง
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                </div>
            ) : assets.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                        <Package className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ไม่พบครุภัณฑ์ตามเงื่อนไขนี้</p>
                        <p className="text-sm text-muted-foreground">
                            ลองเปลี่ยนคำค้นหรือตัวกรอง
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
                                        <TableHead>รหัส</TableHead>
                                        <TableHead>ชื่อครุภัณฑ์</TableHead>
                                        <TableHead>ประเภท</TableHead>
                                        <TableHead>สถานะ</TableHead>
                                        <TableHead>ผู้ครอบครอง</TableHead>
                                        <TableHead>สถานที่</TableHead>
                                        <TableHead>ประกันหมด</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assets.map((asset) => (
                                        <TableRow key={asset.id}>
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                                <Link
                                                    href={`/management/assets/${asset.id}`}
                                                    className="hover:text-primary hover:underline"
                                                >
                                                    {asset.assetCode}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/management/assets/${asset.id}`}
                                                    className="font-medium hover:text-primary hover:underline"
                                                >
                                                    {asset.name}
                                                </Link>
                                                {(asset.brand || asset.model) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {[asset.brand, asset.model]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {asset.typeLabel}
                                            </TableCell>
                                            <TableCell>
                                                <AssetStatusBadge status={asset.status} />
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {asset.custodian?.name ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {asset.location ?? "—"}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm">
                                                        {thaiDate(asset.warrantyEndDate)}
                                                    </span>
                                                    <AssetWarrantyBadge
                                                        warrantyEndDate={asset.warrantyEndDate}
                                                        withinDays={WARRANTY_DAYS}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && assets.length > 0 && (
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

            <AssetFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                people={people}
                departments={departments}
                onSaved={() => void fetchAssets()}
            />

            <AssetImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onImported={() => void fetchAssets()}
            />
        </div>
    )
}
