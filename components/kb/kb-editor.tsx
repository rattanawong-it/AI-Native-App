"use client"

// components/kb/kb-editor.tsx
// ฟอร์มเขียน/แก้บทความ + สลับดูตัวอย่าง Markdown — ใช้ร่วมกันทั้งหน้าสร้างใหม่และหน้าแก้ไข
// อ้างอิง F6.1, F6.2, F6.3, F6.6

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Eye, Pencil, Loader2, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { KbTagChip } from "@/components/kb/kb-badges"
import { KB_VISIBILITIES, KB_VISIBILITY_LABEL } from "@/lib/kb-workflow"
import { readError, type Category } from "@/lib/ticket-types"
import type { KbArticleDetail, KbDetailResponse } from "@/lib/kb-types"

export interface KbEditorInitial {
    title: string
    summary: string
    content: string
    categoryId: string
    tags: string[]
    visibility: string
}

export const EMPTY_ARTICLE: KbEditorInitial = {
    title: "",
    summary: "",
    content: "",
    categoryId: "",
    tags: [],
    visibility: "all",
}

export function articleToInitial(article: KbArticleDetail): KbEditorInitial {
    return {
        title: article.title,
        summary: article.summary ?? "",
        content: article.content,
        categoryId: article.categoryId ?? "",
        tags: article.tags,
        visibility: article.visibility,
    }
}

export default function KbEditor({
    articleId,
    initial,
    categories,
}: {
    /// ไม่ส่ง = สร้างบทความใหม่ · ส่ง = แก้บทความเดิม
    articleId?: string
    initial: KbEditorInitial
    categories: Category[]
}) {
    const router = useRouter()

    const [title, setTitle] = useState(initial.title)
    const [summary, setSummary] = useState(initial.summary)
    const [content, setContent] = useState(initial.content)
    const [categoryId, setCategoryId] = useState(initial.categoryId)
    const [tags, setTags] = useState<string[]>(initial.tags)
    const [tagDraft, setTagDraft] = useState("")
    const [visibility, setVisibility] = useState(initial.visibility)

    const [preview, setPreview] = useState(false)
    const [saving, setSaving] = useState(false)

    /// ตรวจฝั่งหน้าจอให้ตรงกับ createKbArticleSchema จะได้ไม่ต้องรอ API ตีกลับ
    const validation = useMemo(() => {
        if (title.trim().length < 5) return "กรุณากรอกหัวข้ออย่างน้อย 5 ตัวอักษร"
        if (content.trim().length < 20) return "กรุณากรอกเนื้อหาอย่างน้อย 20 ตัวอักษร"
        if (summary.length > 500) return "บทสรุปยาวเกิน 500 ตัวอักษร"
        return null
    }, [title, content, summary])

    const addTag = () => {
        const value = tagDraft.trim()
        if (!value) return
        if (tags.length >= 10) {
            toast.error("ใส่แท็กได้ไม่เกิน 10 รายการ")
            return
        }
        if (!tags.includes(value)) setTags((prev) => [...prev, value])
        setTagDraft("")
    }

    const save = async () => {
        if (validation) {
            toast.error(validation)
            return
        }

        setSaving(true)
        try {
            const payload = {
                title: title.trim(),
                summary: summary.trim() || null,
                content: content.trim(),
                categoryId: categoryId || null,
                tags,
                visibility,
            }

            const res = await fetch(articleId ? `/api/kb/${articleId}` : "/api/kb", {
                method: articleId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถบันทึกบทความได้"))
                return
            }

            const data = (await res.json()) as KbDetailResponse
            // บทความที่เผยแพร่อยู่จะถูก re-index ทันทีหลังแก้ ถ้า embedding ล่มต้องบอกผู้ใช้
            if (data.syncWarning) {
                toast.warning(`บันทึกแล้ว แต่ sync เข้าคลังค้นหาไม่สำเร็จ: ${data.syncWarning}`)
            } else {
                toast.success(articleId ? "บันทึกการแก้ไขแล้ว" : "สร้างบทความฉบับร่างแล้ว")
            }

            router.push(`/management/kb/${data.article.id}/edit`)
            router.refresh()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            {/* ── เนื้อหาหลัก ── */}
            <Card className="lg:col-span-2">
                <CardContent className="space-y-4 p-5">
                    <div className="space-y-2">
                        <Label htmlFor="kb-title">หัวข้อบทความ</Label>
                        <Input
                            id="kb-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="เช่น วิธีรีเซ็ตรหัสผ่านอีเมลมหาวิทยาลัย"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="kb-summary">บทสรุปสั้น (ไม่บังคับ)</Label>
                        <Textarea
                            id="kb-summary"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="สรุปใน 1–2 บรรทัด แสดงในหน้ารายการและใช้เป็นบริบทให้แชตบอท"
                            rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                            {summary.length}/500 ตัวอักษร
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="kb-content">เนื้อหา (Markdown)</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreview((p) => !p)}
                            >
                                {preview ? (
                                    <>
                                        <Pencil className="size-4" aria-hidden />
                                        กลับไปแก้ไข
                                    </>
                                ) : (
                                    <>
                                        <Eye className="size-4" aria-hidden />
                                        ดูตัวอย่าง
                                    </>
                                )}
                            </Button>
                        </div>

                        {preview ? (
                            <div className="prose prose-sm dark:prose-invert min-h-96 max-w-none rounded-md border p-4">
                                {content.trim() ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {content}
                                    </ReactMarkdown>
                                ) : (
                                    <p className="text-muted-foreground">ยังไม่มีเนื้อหา</p>
                                )}
                            </div>
                        ) : (
                            <Textarea
                                id="kb-content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={"## ขั้นตอน\n\n1. เข้าหน้า...\n2. กดปุ่ม...\n\n> ข้อควรระวัง"}
                                rows={20}
                                className="font-mono text-sm"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── ตั้งค่าบทความ ── */}
            <Card className="h-fit">
                <CardContent className="space-y-4 p-5">
                    <div className="space-y-2">
                        <Label htmlFor="kb-category">หมวดหมู่</Label>
                        <select
                            id="kb-category"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        >
                            <option value="">ไม่ระบุหมวดหมู่</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="kb-visibility">ใครอ่านได้</Label>
                        <select
                            id="kb-visibility"
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value)}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        >
                            {KB_VISIBILITIES.map((v) => (
                                <option key={v} value={v}>
                                    {KB_VISIBILITY_LABEL[v]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="kb-tag">แท็ก</Label>
                        <div className="flex gap-2">
                            <Input
                                id="kb-tag"
                                value={tagDraft}
                                onChange={(e) => setTagDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        addTag()
                                    }
                                }}
                                placeholder="พิมพ์แล้วกด Enter"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={addTag}>
                                เพิ่ม
                            </Button>
                        </div>

                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {tags.map((t) => (
                                    <span key={t} className="inline-flex items-center gap-1">
                                        <KbTagChip tag={t} />
                                        <button
                                            type="button"
                                            aria-label={`ลบแท็ก ${t}`}
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() =>
                                                setTags((prev) => prev.filter((x) => x !== t))
                                            }
                                        >
                                            <X className="size-3" aria-hidden />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">{tags.length}/10 แท็ก</p>
                    </div>

                    {validation && (
                        <p className="text-sm text-destructive" role="alert">
                            {validation}
                        </p>
                    )}

                    <Button
                        className="w-full"
                        disabled={saving || Boolean(validation)}
                        onClick={() => void save()}
                    >
                        {saving ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                            <Save className="size-4" aria-hidden />
                        )}
                        {articleId ? "บันทึกการแก้ไข" : "บันทึกเป็นฉบับร่าง"}
                    </Button>

                    {!articleId && (
                        <p className="text-xs text-muted-foreground">
                            บทความใหม่จะถูกบันทึกเป็นฉบับร่างก่อนเสมอ
                            การเผยแพร่ต้องส่งให้หัวหน้างานตรวจอีกขั้น
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
