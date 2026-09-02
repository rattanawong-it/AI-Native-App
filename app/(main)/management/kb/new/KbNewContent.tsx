"use client"

// หน้าเขียนบทความใหม่ — โหลดหมวดหมู่แล้วส่งต่อให้ KbEditor
// รองรับ prefill จาก Ticket ผ่าน query string (F6.13): ?title=...&content=...
// อ้างอิง F6.1, F6.2, F6.13

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import KbEditor, { EMPTY_ARTICLE } from "@/components/kb/kb-editor"
import type { Category } from "@/lib/ticket-types"

export default function KbNewContent() {
    const searchParams = useSearchParams()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    // ค่าตั้งต้นจาก query string — ใช้ตอนกด "บันทึกเป็นองค์ความรู้" จากหน้า Ticket (F6.13)
    const initial = useMemo(
        () => ({
            ...EMPTY_ARTICLE,
            title: searchParams.get("title") ?? "",
            content: searchParams.get("content") ?? "",
            categoryId: searchParams.get("categoryId") ?? "",
        }),
        [searchParams]
    )

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/categories")
                if (res.ok) {
                    const data = (await res.json()) as { categories: Category[] }
                    setCategories(data.categories.filter((c) => c.active))
                }
            } catch {
                // หมวดหมู่โหลดไม่ได้ = เลือกไม่ได้เฉยๆ ยังเขียนบทความต่อได้
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/management/kb">
                        <ChevronLeft className="size-4" aria-hidden />
                        จัดการบทความ
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold">เขียนบทความใหม่</h1>
            </div>

            {loading ? (
                <Skeleton className="h-[32rem] w-full rounded-xl" />
            ) : (
                <KbEditor initial={initial} categories={categories} />
            )}
        </div>
    )
}
