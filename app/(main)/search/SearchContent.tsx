"use client"

// ค้นหารวมข้าม Ticket / บทความ KB / โครงการ / ครุภัณฑ์ (F9.6)
//
// คำค้นอยู่ใน query string `?q=` ไม่ใช่ state ในหน้า ผู้ใช้จึงส่งลิงก์ผลการค้นหาให้กันได้
// และปุ่มย้อนกลับของเบราว์เซอร์ทำงานตามที่คาด

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowUpRight, BookOpen, PanelsTopLeft, Package, Search, Ticket } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { readError } from "@/lib/ticket-types"

type SearchSource = "ticket" | "kb" | "project" | "asset"

interface GlobalSearchHit {
    source: SearchSource
    id: string
    title: string
    code: string | null
    status: string | null
    context: string | null
    href: string
}

interface SearchResponse {
    query: string
    hits: GlobalSearchHit[]
    counts: Record<SearchSource, number>
}

const SOURCE_META: Record<
    SearchSource,
    { label: string; icon: React.ComponentType<{ className?: string }>; all: string }
> = {
    ticket: { label: "Ticket", icon: Ticket, all: "/service/tickets" },
    kb: { label: "บทความในคลังความรู้", icon: BookOpen, all: "/service/kb" },
    project: { label: "โครงการพัฒนา", icon: PanelsTopLeft, all: "/management/projects" },
    asset: { label: "ครุภัณฑ์", icon: Package, all: "/management/assets" },
}

const ORDER: SearchSource[] = ["ticket", "kb", "project", "asset"]

export default function SearchContent() {
    const router = useRouter()
    const params = useSearchParams()
    const query = params.get("q") ?? ""

    const [draft, setDraft] = useState(query)
    const [result, setResult] = useState<SearchResponse | null>(null)
    const [loading, setLoading] = useState(false)

    // คำค้นเปลี่ยนจากภายนอก (กดย้อนกลับ / เปิดลิงก์) ต้องอัปเดตช่องกรอกตาม
    useEffect(() => {
        setDraft(query)
    }, [query])

    const run = useCallback(async (q: string) => {
        if (q.trim().length < 2) {
            setResult(null)
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`)
            if (!res.ok) {
                toast.error(await readError(res, "ค้นหาไม่สำเร็จ"))
                return
            }
            setResult((await res.json()) as SearchResponse)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void run(query)
    }, [run, query])

    function submit(e: React.FormEvent) {
        e.preventDefault()
        const q = draft.trim()
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
    }

    const total = result?.hits.length ?? 0

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">ค้นหารวม</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    ค้นข้าม Ticket, บทความในคลังความรู้, โครงการ และครุภัณฑ์ในครั้งเดียว ·
                    แสดงเฉพาะสิ่งที่คุณมีสิทธิ์เห็น
                </p>
            </div>

            <form onSubmit={submit} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="เลขที่ Ticket, ชื่อเรื่อง, รหัสครุภัณฑ์, S/N, ชื่อโครงการ…"
                        className="pl-9"
                        autoFocus
                    />
                </div>
                <Button type="submit">ค้นหา</Button>
            </form>

            {loading ? (
                <Skeleton className="h-64 w-full" />
            ) : !query ? (
                <EmptyState text="พิมพ์คำที่ต้องการค้นแล้วกดค้นหา" />
            ) : query.trim().length < 2 ? (
                <EmptyState text="พิมพ์คำค้นอย่างน้อย 2 ตัวอักษร" />
            ) : total === 0 ? (
                <EmptyState text={`ไม่พบสิ่งที่ตรงกับ “${query}”`} />
            ) : (
                <>
                    <p className="text-muted-foreground text-sm">
                        พบ {total} รายการที่ตรงกับ “{query}” · แสดงสูงสุดแหล่งละ 5 รายการ
                    </p>

                    {ORDER.map((source) => {
                        const hits = result?.hits.filter((h) => h.source === source) ?? []
                        if (hits.length === 0) return null
                        const meta = SOURCE_META[source]
                        const Icon = meta.icon

                        return (
                            <Card key={source} className="overflow-hidden py-0">
                                <CardHeader className="bg-muted/40 flex flex-row items-center justify-between gap-2 border-b py-3">
                                    <p className="flex items-center gap-2 font-medium">
                                        <Icon className="text-muted-foreground size-4" />
                                        {meta.label}
                                        <span className="text-muted-foreground text-xs font-normal">
                                            ({hits.length})
                                        </span>
                                    </p>
                                    <Link
                                        href={meta.all}
                                        className="text-primary flex items-center gap-1 text-xs hover:underline"
                                    >
                                        ไปหน้ารายการ
                                        <ArrowUpRight className="size-3" />
                                    </Link>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y">
                                        {hits.map((h) => (
                                            <Link
                                                key={`${h.source}-${h.id}`}
                                                href={h.href}
                                                className="hover:bg-muted/50 block px-4 py-3 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        {h.code && (
                                                            <p className="text-muted-foreground font-mono text-xs">
                                                                {h.code}
                                                            </p>
                                                        )}
                                                        <p className="mt-0.5 truncate text-sm font-medium">
                                                            {h.title}
                                                        </p>
                                                        {h.context && (
                                                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                                                {h.context}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {h.status && (
                                                        <span className="text-muted-foreground shrink-0 text-xs">
                                                            {h.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </>
            )}
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return (
        <Card>
            <CardContent className="text-muted-foreground py-16 text-center text-sm">
                <Search className="mx-auto mb-2 size-6 opacity-40" />
                {text}
            </CardContent>
        </Card>
    )
}
