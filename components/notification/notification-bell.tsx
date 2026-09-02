"use client"

// components/notification/notification-bell.tsx
// กระดิ่งแจ้งเตือนบน Header + รายการแบบ dropdown (F8.2)
//
// การดึงข้อมูล: โหลดครั้งแรกตอน mount แล้ว poll ทุก 60 วินาที
// เลือก polling แทน WebSocket/SSE เพราะระบบยังไม่มีชั้น realtime และการแจ้งเตือนของงาน Helpdesk
// ไม่ได้ต้องการความเร็วระดับวินาที · ช่วงเวลาที่ผู้ใช้ไม่ได้เปิดแท็บนี้ไว้จะไม่ยิงเลย (ดู visibilitychange)

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Loader2, AlertTriangle } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelative, readError } from "@/lib/ticket-types"
import {
    NOTIFICATION_TYPE_LABEL,
    type NotificationListResponse,
    type NotificationRow,
} from "@/lib/notification-client-types"

/// ระยะห่างของการดึงข้อมูลซ้ำ
const POLL_MS = 60_000

/// จำนวนรายการที่แสดงใน dropdown — มากกว่านี้ให้กดดูหน้ารวม
const PAGE_SIZE = 10

export default function NotificationBell() {
    const { data: session } = useSession()
    const [items, setItems] = useState<NotificationRow[]>([])
    const [unread, setUnread] = useState(0)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    /// กันการยิงซ้อนกันเมื่อ poll ชนกับการกดเปิด dropdown
    const inFlight = useRef(false)

    const load = useCallback(async () => {
        if (inFlight.current) return
        inFlight.current = true
        setLoading(true)
        try {
            const res = await fetch(`/api/notifications?state=all&pageSize=${PAGE_SIZE}`)
            if (!res.ok) return
            const data = (await res.json()) as NotificationListResponse
            setItems(data.notifications)
            setUnread(data.unreadCount)
        } catch {
            // กระดิ่งเป็นข้อมูลรอง — โหลดไม่ได้ก็ไม่ต้องรบกวนผู้ใช้ด้วย toast
        } finally {
            inFlight.current = false
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!session?.user) return
        void load()

        // หยุด poll เมื่อผู้ใช้สลับไปแท็บอื่น แล้วดึงทันทีที่กลับมา
        const tick = () => {
            if (document.visibilityState === "visible") void load()
        }
        const timer = setInterval(tick, POLL_MS)
        document.addEventListener("visibilitychange", tick)
        return () => {
            clearInterval(timer)
            document.removeEventListener("visibilitychange", tick)
        }
    }, [session?.user, load])

    /// เปิด dropdown แล้วดึงข้อมูลสดทันที ไม่ต้องรอรอบ poll ถัดไป
    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) void load()
    }

    /// กดที่รายการ = ถือว่าอ่านแล้ว · อัปเดตหน้าจอก่อนแล้วค่อยยืนยันกับเซิร์ฟเวอร์
    const markRead = async (row: NotificationRow) => {
        if (row.isRead) return
        setItems((list) => list.map((n) => (n.id === row.id ? { ...n, isRead: true } : n)))
        setUnread((n) => Math.max(0, n - 1))
        try {
            await fetch(`/api/notifications/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isRead: true }),
            })
        } catch {
            void load()
        }
    }

    const markAllRead = async () => {
        setItems((list) => list.map((n) => ({ ...n, isRead: true })))
        setUnread(0)
        try {
            const res = await fetch("/api/notifications/read-all", { method: "POST" })
            if (!res.ok) {
                console.error(await readError(res))
                void load()
            }
        } catch {
            void load()
        }
    }

    if (!session?.user) return null

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <button
                    className="hover:bg-accent relative flex size-9 items-center justify-center rounded-md transition-colors"
                    aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
                >
                    <Bell className="text-muted-foreground size-5" />
                    {unread > 0 && (
                        <span className="bg-priority-critical text-priority-critical-fg absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
                            {unread > 99 ? "99+" : unread}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[380px] p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <p className="text-sm font-medium">
                        การแจ้งเตือน
                        {unread > 0 && (
                            <span className="text-muted-foreground ml-1.5 font-normal">
                                ({unread} ใหม่)
                            </span>
                        )}
                    </p>
                    {unread > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void markAllRead()}
                        >
                            <CheckCheck className="size-3.5" />
                            อ่านทั้งหมด
                        </Button>
                    )}
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                    {loading && items.length === 0 ? (
                        <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                            <Loader2 className="size-4 animate-spin" />
                            กำลังโหลด...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-muted-foreground py-10 text-center text-sm">
                            <Bell className="mx-auto mb-2 size-7 opacity-40" />
                            ยังไม่มีการแจ้งเตือน
                        </div>
                    ) : (
                        items.map((row, i) => (
                            <NotificationItem
                                key={row.id}
                                row={row}
                                divided={i > 0}
                                onActivate={() => void markRead(row)}
                                onNavigate={() => setOpen(false)}
                            />
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

function NotificationItem({
    row,
    divided,
    onActivate,
    onNavigate,
}: {
    row: NotificationRow
    divided: boolean
    onActivate: () => void
    onNavigate: () => void
}) {
    /// ช่องทางที่ส่งไม่ผ่าน — บอกผู้ใช้ว่าเมล/LINE ไม่ถึง จะได้ไม่รอเก้อ
    const failed = row.deliveries.filter((d) => d.status === "failed")

    const inner = (
        <>
            <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center">
                {!row.isRead && <span className="bg-brand size-2 rounded-full" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="text-muted-foreground block text-[11px]">
                    {NOTIFICATION_TYPE_LABEL[row.type] ?? row.type} · {formatRelative(row.createdAt)}
                </span>
                <span
                    className={
                        row.isRead
                            ? "mt-0.5 block truncate text-sm"
                            : "mt-0.5 block truncate text-sm font-medium"
                    }
                >
                    {row.title}
                </span>
                <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs whitespace-pre-wrap">
                    {row.body}
                </span>
                {failed.length > 0 && (
                    <span className="text-sla-atrisk mt-1 flex items-center gap-1 text-[11px]">
                        <AlertTriangle className="size-3" />
                        ส่งทาง {failed.map((f) => f.channel).join(", ")} ไม่สำเร็จ
                    </span>
                )}
            </span>
        </>
    )

    const layout = `hover:bg-accent/50 flex w-full gap-3 px-4 py-3 text-left transition-colors${
        divided ? " border-t" : ""
    }`

    if (!row.linkUrl) {
        return (
            <button type="button" className={layout} onClick={onActivate}>
                {inner}
            </button>
        )
    }

    return (
        <Link
            href={row.linkUrl}
            className={layout}
            onClick={() => {
                onActivate()
                onNavigate()
            }}
        >
            {inner}
        </Link>
    )
}
