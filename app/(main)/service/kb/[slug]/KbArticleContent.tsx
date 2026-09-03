"use client"

// หน้าอ่านบทความคลังความรู้ — render Markdown, นับยอดเข้าอ่าน, โหวตมีประโยชน์
// อ้างอิง F6.2, F6.6, F6.7, F6.8

import { rolesAreManager, rolesAreStaff } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    ChevronLeft,
    Eye,
    ThumbsUp,
    ThumbsDown,
    Pencil,
    Loader2,
    BookOpen,
    CalendarDays,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { KbStatusBadge, KbVisibilityBadge, KbTagChip } from "@/components/kb/kb-badges"
import { readError } from "@/lib/ticket-types"
import type { KbArticleDetail, KbDetailResponse } from "@/lib/kb-types"

/// วันที่แบบไทย พ.ศ. ตาม NFR4
function formatThaiDate(value: string | null): string {
    if (!value) return "—"
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Bangkok",
    })
}

export default function KbArticleContent({ slugOrId }: { slugOrId: string }) {
    const { data: session } = useSession()
    const currentUserId = (session?.user as { id?: string })?.id
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const isStaff = rolesAreStaff(roles)

    const [article, setArticle] = useState<KbArticleDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [voting, setVoting] = useState(false)
    /// จำโหวตล่าสุดในหน้านี้ไว้ เพื่อไฮไลต์ปุ่มที่ผู้ใช้เพิ่งกด
    const [myVote, setMyVote] = useState<boolean | null>(null)

    const fetchArticle = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/kb/${encodeURIComponent(slugOrId)}`)
            if (res.status === 404) {
                setNotFound(true)
                return
            }
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดบทความได้"))
                return
            }
            const data = (await res.json()) as KbDetailResponse
            setArticle(data.article)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [slugOrId])

    useEffect(() => {
        void fetchArticle()
    }, [fetchArticle])

    const sendFeedback = async (isHelpful: boolean) => {
        if (!article) return
        setVoting(true)
        try {
            const res = await fetch(`/api/kb/${article.id}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isHelpful }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกความเห็นได้"))
                return
            }
            const data = (await res.json()) as {
                helpfulCount?: number
                notHelpfulCount?: number
                message?: string
            }

            setMyVote(isHelpful)
            // API คืนตัวนับใหม่มาให้เฉพาะตอนที่มีการเปลี่ยนแปลงจริง
            if (data.helpfulCount !== undefined && data.notHelpfulCount !== undefined) {
                setArticle((prev) =>
                    prev
                        ? {
                              ...prev,
                              helpfulCount: data.helpfulCount!,
                              notHelpfulCount: data.notHelpfulCount!,
                          }
                        : prev
                )
            }
            toast.success(data.message || "ขอบคุณสำหรับความเห็น")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setVoting(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 p-4 md:p-6">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        )
    }

    if (notFound || !article) {
        return (
            <div className="p-4 md:p-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                        <BookOpen className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ไม่พบบทความที่ต้องการ</p>
                        <p className="text-sm text-muted-foreground">
                            บทความอาจถูกถอนออกจากการเผยแพร่ หรือคุณไม่มีสิทธิ์อ่าน
                        </p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/service/kb">
                                <ChevronLeft className="size-4" aria-hidden />
                                กลับไปคลังความรู้
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const canEdit = isStaff && (article.authorId === currentUserId || rolesAreManager(roles))

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/service/kb">
                        <ChevronLeft className="size-4" aria-hidden />
                        คลังความรู้
                    </Link>
                </Button>

                {canEdit && (
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/management/kb/${article.id}/edit`}>
                            <Pencil className="size-4" aria-hidden />
                            แก้ไขบทความ
                        </Link>
                    </Button>
                )}
            </div>

            <article className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {article.category && (
                        <span className="text-sm font-medium text-primary">
                            {article.category.name}
                        </span>
                    )}
                    {article.visibility === "agent_only" && (
                        <KbVisibilityBadge visibility={article.visibility} />
                    )}
                    {article.status !== "published" && <KbStatusBadge status={article.status} />}
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>

                {article.summary && (
                    <p className="text-base text-muted-foreground">{article.summary}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 border-y py-3 text-sm text-muted-foreground">
                    <span>โดย {article.author.name}</span>
                    <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {formatThaiDate(article.publishedAt ?? article.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Eye className="size-3.5" aria-hidden />
                        เข้าอ่าน {article.viewCount} ครั้ง
                    </span>
                </div>

                {/* F6.2 — เนื้อหา Markdown ใช้ react-markdown + remark-gfm ที่มีอยู่แล้วในโปรเจกต์ */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
                </div>

                {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                        {article.tags.map((t) => (
                            <KbTagChip key={t} tag={t} />
                        ))}
                    </div>
                )}
            </article>

            {/* ── โหวตมีประโยชน์ (F6.8) ── */}
            <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                        <p className="font-medium">บทความนี้ช่วยแก้ปัญหาของคุณได้ไหม</p>
                        <p className="text-sm text-muted-foreground">
                            มีประโยชน์ {article.helpfulCount} · ไม่มีประโยชน์{" "}
                            {article.notHelpfulCount}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant={myVote === true ? "default" : "outline"}
                            size="sm"
                            disabled={voting}
                            onClick={() => void sendFeedback(true)}
                        >
                            {voting ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                                <ThumbsUp className="size-4" aria-hidden />
                            )}
                            มีประโยชน์
                        </Button>
                        <Button
                            variant={myVote === false ? "default" : "outline"}
                            size="sm"
                            disabled={voting}
                            onClick={() => void sendFeedback(false)}
                        >
                            <ThumbsDown className="size-4" aria-hidden />
                            ไม่มีประโยชน์
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
