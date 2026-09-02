"use client"

// หน้าแก้ไขบทความ — ฟอร์มเดียวกับหน้าเขียนใหม่ บวกแถบจัดการสถานะการเผยแพร่
// อ้างอิง F6.1, F6.2, F6.4, F6.5, F6.9, F6.10

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Loader2, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import KbEditor, { articleToInitial } from "@/components/kb/kb-editor"
import { KbStatusBadge, KbIndexBadge } from "@/components/kb/kb-badges"
import { nextStatuses, type KbStatus } from "@/lib/kb-workflow"
import { readError, type Category } from "@/lib/ticket-types"
import type { KbArticleDetail, KbDetailResponse } from "@/lib/kb-types"

const ACTION_LABEL: Record<KbStatus, string> = {
    draft: "ถอนกลับเป็นร่าง",
    pending_review: "ส่งตรวจ",
    published: "เผยแพร่",
    archived: "เก็บเข้ากรุ",
}

export default function KbEditContent({ articleId }: { articleId: string }) {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canPublish = roles.some((r) => ["manager", "admin"].includes(r))

    const [article, setArticle] = useState<KbArticleDetail | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [changing, setChanging] = useState(false)

    const fetchArticle = useCallback(async () => {
        try {
            const res = await fetch(`/api/kb/${encodeURIComponent(articleId)}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดบทความได้"))
                return
            }
            const data = (await res.json()) as KbDetailResponse
            setArticle(data.article)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        }
    }, [articleId])

    useEffect(() => {
        void (async () => {
            await fetchArticle()
            try {
                const res = await fetch("/api/categories")
                if (res.ok) {
                    const data = (await res.json()) as { categories: Category[] }
                    setCategories(data.categories.filter((c) => c.active))
                }
            } catch {
                // หมวดหมู่โหลดไม่ได้ = เลือกไม่ได้เฉยๆ ยังแก้บทความต่อได้
            } finally {
                setLoading(false)
            }
        })()
    }, [fetchArticle])

    const changeStatus = async (next: KbStatus) => {
        if (!article) return
        setChanging(true)
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
            const data = (await res.json()) as {
                article: KbArticleDetail
                message?: string
                syncWarning?: string
            }
            setArticle(data.article)

            if (data.syncWarning) {
                toast.warning(
                    `${data.message ?? "เปลี่ยนสถานะแล้ว"} — แต่ sync ไม่สำเร็จ: ${data.syncWarning}`
                )
            } else {
                toast.success(data.message ?? "เปลี่ยนสถานะแล้ว")
            }
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setChanging(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 p-4 md:p-6">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-[32rem] w-full rounded-xl" />
            </div>
        )
    }

    if (!article) {
        return (
            <div className="p-4 md:p-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                        <p className="font-medium">ไม่พบบทความที่ต้องการแก้ไข</p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/management/kb">
                                <ChevronLeft className="size-4" aria-hidden />
                                กลับไปจัดการบทความ
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const actions = nextStatuses(article.status, canPublish)

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/management/kb">
                            <ChevronLeft className="size-4" aria-hidden />
                            จัดการบทความ
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-semibold">แก้ไขบทความ</h1>
                </div>

                <Button variant="outline" size="sm" asChild>
                    <Link href={`/service/kb/${article.slug}`}>
                        <ExternalLink className="size-4" aria-hidden />
                        ดูหน้าอ่าน
                    </Link>
                </Button>
            </div>

            {/* ── แถบสถานะ + ปุ่ม workflow (F6.4, F6.5) ── */}
            <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <KbStatusBadge status={article.status} />
                        <KbIndexBadge isIndexed={article.isIndexed} status={article.status} />
                        {article.reviewer && (
                            <span className="text-xs text-muted-foreground">
                                ตรวจโดย {article.reviewer.name}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {actions.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                                การเผยแพร่ต้องใช้สิทธิ์หัวหน้างานขึ้นไป
                            </span>
                        ) : (
                            actions.map((next) => (
                                <Button
                                    key={next}
                                    variant={next === "published" ? "default" : "outline"}
                                    size="sm"
                                    disabled={changing}
                                    onClick={() => void changeStatus(next)}
                                >
                                    {changing && (
                                        <Loader2 className="size-4 animate-spin" aria-hidden />
                                    )}
                                    {ACTION_LABEL[next]}
                                </Button>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <KbEditor
                articleId={article.id}
                initial={articleToInitial(article)}
                categories={categories}
            />
        </div>
    )
}
