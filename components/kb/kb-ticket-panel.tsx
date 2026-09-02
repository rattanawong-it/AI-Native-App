"use client"

// components/kb/kb-ticket-panel.tsx
// การ์ด "บทความที่เกี่ยวข้อง" ในหน้า Ticket + ปุ่มบันทึก Ticket ที่แก้แล้วเป็นองค์ความรู้
// อ้างอิง F6.12, F6.13
//
// แยกเป็นคอมโพเนนต์เดี่ยวเพื่อให้ TicketDetailContent.tsx (ไฟล์นอกตาราง M1–M13)
// ถูกแก้แค่จุดเดียว — ตรรกะทั้งหมดอยู่ในไฟล์ใหม่นี้

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, Lightbulb, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { KbSuggestResponse, KbSuggestion } from "@/lib/kb-types"

export function KbSuggestionCard({ ticketId }: { ticketId: string }) {
    const [suggestions, setSuggestions] = useState<KbSuggestion[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        void (async () => {
            try {
                const res = await fetch(`/api/kb/suggest?ticketId=${encodeURIComponent(ticketId)}`)
                if (!res.ok) return
                const data = (await res.json()) as KbSuggestResponse
                if (!cancelled) setSuggestions(data.suggestions)
            } catch {
                // ค้นหาไม่ได้ = ซ่อนการ์ดไปเงียบๆ ไม่ต้องรบกวนคนที่กำลังทำงานกับ Ticket
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [ticketId])

    if (loading) return <Skeleton className="h-32 w-full rounded-xl" />

    // ไม่มีบทความที่เกี่ยวข้อง = ไม่ต้องแสดงการ์ดเปล่า
    if (suggestions.length === 0) return null

    return (
        <Card>
            <CardHeader>
                <h2 className="flex items-center gap-2 font-medium">
                    <Lightbulb className="text-brand size-4" />
                    บทความที่เกี่ยวข้อง
                </h2>
            </CardHeader>
            <CardContent className="space-y-3">
                {suggestions.map((article) => (
                    <div key={article.id} className="space-y-1">
                        <Link
                            href={`/service/kb/${article.slug}`}
                            className="text-brand text-sm font-medium hover:underline"
                        >
                            {article.title}
                        </Link>
                        {article.summary && (
                            <p className="text-muted-foreground line-clamp-2 text-sm">
                                {article.summary}
                            </p>
                        )}
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Sparkles className="size-3" aria-hidden />
                            ความเกี่ยวข้อง {Math.round(article.similarity * 100)}%
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

/// ปุ่ม "บันทึกเป็นองค์ความรู้" (F6.13) — พาไปหน้าเขียนบทความพร้อม prefill จากสรุปการแก้ไข
export function SaveAsKbButton({
    title,
    resolutionNote,
    categoryId,
}: {
    title: string
    resolutionNote: string
    categoryId?: string | null
}) {
    const params = new URLSearchParams({
        title,
        content: resolutionNote,
    })
    if (categoryId) params.set("categoryId", categoryId)

    return (
        <Button variant="outline" size="sm" asChild>
            <Link href={`/management/kb/new?${params.toString()}`}>
                <BookOpen className="size-4" aria-hidden />
                บันทึกเป็นองค์ความรู้
            </Link>
        </Button>
    )
}
