"use client"

// หน้ารายการบทความคลังความรู้ — ค้นหา / ฟิลเตอร์หมวดหมู่+แท็ก / เรียงลำดับ / pagination
// อ้างอิง F6.1, F6.3, F6.6, F6.7

import { rolesAreStaff } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    Search,
    Plus,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    Eye,
    ThumbsUp,
    ListFilter,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { KbStatusBadge, KbVisibilityBadge, KbTagChip } from "@/components/kb/kb-badges"
import { readError, type Category } from "@/lib/ticket-types"
import {
    KB_SORT_OPTIONS,
    type KbArticleRow,
    type KbListResponse,
} from "@/lib/kb-types"

const PAGE_SIZE = 12

export default function KbListContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isStaff = rolesAreStaff(roles)

    const [articles, setArticles] = useState<KbArticleRow[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [categoryId, setCategoryId] = useState("all")
    const [tag, setTag] = useState("")
    const [sort, setSort] = useState<string>("latest")
    const [page, setPage] = useState(1)

    // หน่วงการค้นหาไว้ 350ms กันยิง API ทุกตัวอักษร (แนวเดียวกับหน้ารายการ Ticket)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [search])

    /// ประกอบ query string ให้ตรงกับ listKbQuerySchema
    /// หน้านี้เป็นฝั่ง "อ่าน" จึงล็อก publishedOnly ไว้เสมอ — ฉบับร่างอยู่ที่หน้าจัดการ
    const queryString = useMemo(() => {
        const params = new URLSearchParams()
        if (debouncedSearch) params.set("q", debouncedSearch)
        if (categoryId !== "all") params.set("categoryId", categoryId)
        if (tag) params.set("tag", tag)
        params.set("publishedOnly", "true")
        params.set("sort", sort)
        params.set("page", String(page))
        params.set("pageSize", String(PAGE_SIZE))
        return params.toString()
    }, [debouncedSearch, categoryId, tag, sort, page])

    const fetchArticles = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/kb?${queryString}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายการบทความได้"))
                return
            }
            const data = (await res.json()) as KbListResponse
            setArticles(data.articles)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [queryString])

    useEffect(() => {
        void fetchArticles()
    }, [fetchArticles])

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/categories")
                if (!res.ok) return
                const data = (await res.json()) as { categories: Category[] }
                setCategories(data.categories.filter((c) => c.active))
            } catch {
                // หมวดหมู่โหลดไม่ได้ = ฟิลเตอร์หายไปเฉยๆ ไม่ต้องรบกวนผู้ใช้ด้วย toast
            }
        })()
    }, [])

    const clearFilters = () => {
        setSearch("")
        setCategoryId("all")
        setTag("")
        setSort("latest")
        setPage(1)
    }

    const hasFilter = Boolean(debouncedSearch || tag || categoryId !== "all")

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* ── หัวข้อหน้า ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold">
                        <BookOpen className="size-6 text-primary" aria-hidden />
                        คลังความรู้
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        วิธีแก้ปัญหาที่พบบ่อย คู่มือการใช้งาน และคำแนะนำจากเจ้าหน้าที่ศูนย์ไอที
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchArticles()}>
                        <RefreshCw className="size-4" aria-hidden />
                        รีเฟรช
                    </Button>
                    {isStaff && (
                        <Button size="sm" asChild>
                            <Link href="/management/kb/new">
                                <Plus className="size-4" aria-hidden />
                                เขียนบทความ
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {/* ── ค้นหา + ฟิลเตอร์ (F6.3) ── */}
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
                            placeholder="ค้นหาจากหัวข้อ เนื้อหา หรือแท็ก"
                            className="pl-9"
                            aria-label="ค้นหาบทความ"
                        />
                    </div>

                    <select
                        value={categoryId}
                        onChange={(e) => {
                            setCategoryId(e.target.value)
                            setPage(1)
                        }}
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        aria-label="กรองตามหมวดหมู่"
                    >
                        <option value="all">ทุกหมวดหมู่</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={sort}
                        onChange={(e) => {
                            setSort(e.target.value)
                            setPage(1)
                        }}
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        aria-label="เรียงลำดับ"
                    >
                        {KB_SORT_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                                {o.label}
                            </option>
                        ))}
                    </select>

                    {hasFilter && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <ListFilter className="size-4" aria-hidden />
                            ล้างตัวกรอง
                        </Button>
                    )}
                </CardContent>
            </Card>

            {tag && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    กำลังกรองด้วยแท็ก
                    <KbTagChip tag={tag} active onClick={() => setTag("")} />
                    <span className="text-xs">(กดที่แท็กเพื่อยกเลิก)</span>
                </div>
            )}

            {/* ── รายการบทความ ── */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                        <BookOpen className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ยังไม่มีบทความที่ตรงกับเงื่อนไข</p>
                        <p className="text-sm text-muted-foreground">
                            {hasFilter
                                ? "ลองปรับคำค้นหรือล้างตัวกรองดูอีกครั้ง"
                                : "เมื่อเจ้าหน้าที่เผยแพร่บทความแล้ว จะแสดงที่นี่"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {articles.map((article) => (
                        <Card key={article.id} className="transition-shadow hover:shadow-md">
                            <CardContent className="flex h-full flex-col gap-3 p-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    {article.category && (
                                        <span className="text-xs font-medium text-primary">
                                            {article.category.name}
                                        </span>
                                    )}
                                    {article.visibility === "agent_only" && (
                                        <KbVisibilityBadge visibility={article.visibility} />
                                    )}
                                    {isStaff && article.status !== "published" && (
                                        <KbStatusBadge status={article.status} />
                                    )}
                                </div>

                                <Link
                                    href={`/service/kb/${article.slug}`}
                                    className="text-base font-semibold hover:text-primary hover:underline"
                                >
                                    {article.title}
                                </Link>

                                <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                                    {article.summary || "ไม่มีบทสรุป — กดเข้าไปอ่านเนื้อหาเต็ม"}
                                </p>

                                {article.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {article.tags.slice(0, 4).map((t) => (
                                            <KbTagChip
                                                key={t}
                                                tag={t}
                                                active={t === tag}
                                                onClick={(value) => {
                                                    setTag(value === tag ? "" : value)
                                                    setPage(1)
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Eye className="size-3.5" aria-hidden />
                                        {article.viewCount} ครั้ง
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <ThumbsUp className="size-3.5" aria-hidden />
                                        {article.helpfulCount}
                                    </span>
                                    <span className="ml-auto truncate">{article.author.name}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ── Pagination (NFR9) ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                        ทั้งหมด {total} บทความ · หน้า {page} จาก {totalPages}
                    </span>
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
