"use client"

// หน้าจัดการบทความคลังความรู้ — ดูทุกสถานะ ส่งตรวจ เผยแพร่ ถอน และเก็บเข้ากรุ
// อ้างอิง F6.1, F6.4, F6.5, F6.9, F6.10

import { rolesAreManager } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    Search,
    Plus,
    RefreshCw,
    Pencil,
    Trash2,
    Loader2,
    BookMarked,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
import { KbStatusBadge, KbVisibilityBadge, KbIndexBadge } from "@/components/kb/kb-badges"
import {
    KB_STATUSES,
    KB_STATUS_LABEL,
    nextStatuses,
    type KbStatus,
} from "@/lib/kb-workflow"
import { readError } from "@/lib/ticket-types"
import type { KbArticleRow, KbListResponse } from "@/lib/kb-types"

const PAGE_SIZE = 20

const STATUS_TABS: { key: string; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    ...KB_STATUSES.map((s) => ({ key: s, label: KB_STATUS_LABEL[s] })),
]

export default function KbManageContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canPublish = rolesAreManager(roles)

    const [articles, setArticles] = useState<KbArticleRow[]>([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<KbArticleRow | null>(null)

    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [status, setStatus] = useState("all")
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
        if (status !== "all") params.set("status", status)
        params.set("sort", "latest")
        params.set("page", String(page))
        params.set("pageSize", String(PAGE_SIZE))
        return params.toString()
    }, [debouncedSearch, status, page])

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

    /// เปลี่ยนสถานะผ่าน endpoint publish เสมอ เพื่อให้ sync เข้า/ออก pgvector ทำงานด้วย
    const changeStatus = async (article: KbArticleRow, next: KbStatus) => {
        setBusyId(article.id)
        try {
            const res = await fetch(`/api/kb/${article.id}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: next }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถเปลี่ยนสถานะได้"))
                return
            }
            const data = (await res.json()) as { message?: string; syncWarning?: string }

            // การ embed ใช้ OpenAI ซึ่งล่ม/หมดเครดิตได้ — สถานะเปลี่ยนสำเร็จแต่ต้องเตือนว่ายังไม่เข้าคลัง
            if (data.syncWarning) {
                toast.warning(`${data.message ?? "เปลี่ยนสถานะแล้ว"} — แต่ sync ไม่สำเร็จ: ${data.syncWarning}`)
            } else {
                toast.success(data.message ?? "เปลี่ยนสถานะแล้ว")
            }
            await fetchArticles()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusyId(null)
        }
    }

    const deleteArticle = async (article: KbArticleRow) => {
        setBusyId(article.id)
        try {
            const res = await fetch(`/api/kb/${article.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถลบบทความได้"))
                return
            }
            toast.success("ลบบทความและถอนออกจากคลังค้นหาแล้ว")
            await fetchArticles()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusyId(null)
            setPendingDelete(null)
        }
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold">
                        <BookMarked className="size-6 text-primary" aria-hidden />
                        จัดการบทความ
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        เขียน ตรวจทาน และเผยแพร่บทความ — บทความที่เผยแพร่จะถูกส่งเข้าคลังค้นหาของแชตบอทอัตโนมัติ
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void fetchArticles()}>
                        <RefreshCw className="size-4" aria-hidden />
                        รีเฟรช
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/management/kb/new">
                            <Plus className="size-4" aria-hidden />
                            เขียนบทความ
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
                            placeholder="ค้นหาบทความ"
                            className="pl-9"
                            aria-label="ค้นหาบทความ"
                        />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
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
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                        <BookMarked className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ยังไม่มีบทความในสถานะนี้</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {articles.map((article) => {
                        const actions = nextStatuses(article.status, canPublish)
                        const busy = busyId === article.id

                        return (
                            <Card key={article.id}>
                                <CardContent className="flex flex-wrap items-start gap-4 p-5">
                                    <div className="min-w-56 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <KbStatusBadge status={article.status} />
                                            <KbVisibilityBadge visibility={article.visibility} />
                                            <KbIndexBadge
                                                isIndexed={article.isIndexed}
                                                status={article.status}
                                            />
                                            {article.category && (
                                                <span className="text-xs text-muted-foreground">
                                                    {article.category.name}
                                                </span>
                                            )}
                                        </div>

                                        <Link
                                            href={`/service/kb/${article.slug}`}
                                            className="block font-medium hover:text-primary hover:underline"
                                        >
                                            {article.title}
                                        </Link>

                                        <p className="text-xs text-muted-foreground">
                                            โดย {article.author.name}
                                            {article.reviewer && ` · ตรวจโดย ${article.reviewer.name}`}
                                            {` · เข้าอ่าน ${article.viewCount} ครั้ง`}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {actions.map((next) => (
                                            <Button
                                                key={next}
                                                variant={next === "published" ? "default" : "outline"}
                                                size="sm"
                                                disabled={busy}
                                                onClick={() => void changeStatus(article, next)}
                                            >
                                                {busy && (
                                                    <Loader2
                                                        className="size-4 animate-spin"
                                                        aria-hidden
                                                    />
                                                )}
                                                {next === "published"
                                                    ? "เผยแพร่"
                                                    : next === "pending_review"
                                                      ? "ส่งตรวจ"
                                                      : next === "draft"
                                                        ? "ถอนกลับเป็นร่าง"
                                                        : "เก็บเข้ากรุ"}
                                            </Button>
                                        ))}

                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/management/kb/${article.id}/edit`}>
                                                <Pencil className="size-4" aria-hidden />
                                                แก้ไข
                                            </Link>
                                        </Button>

                                        {canPublish && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={busy}
                                                onClick={() => setPendingDelete(article)}
                                            >
                                                <Trash2
                                                    className="size-4 text-destructive"
                                                    aria-hidden
                                                />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

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

            {/* ยืนยันก่อนลบ — ใช้ AlertDialog ของ shadcn ไม่ใช้ confirm() ของเบราว์เซอร์ */}
            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => !open && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบบทความนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pendingDelete?.title}&rdquo; จะถูกลบถาวร
                            พร้อมถอนเนื้อหาออกจากคลังค้นหาของแชตบอทด้วย การกระทำนี้ย้อนกลับไม่ได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => pendingDelete && void deleteArticle(pendingDelete)}
                        >
                            ลบบทความ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
