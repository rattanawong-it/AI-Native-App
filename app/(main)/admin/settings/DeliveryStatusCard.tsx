"use client"

// การ์ด "ผลการส่งแจ้งเตือน" ในแท็บการแจ้งเตือนของหน้าตั้งค่าระบบ (F8.8)
//
// อ่านจาก `NotificationDelivery` ซึ่งบันทึกผลทุกครั้งที่ส่ง — ทำให้ตอบได้ว่าเมลหรือ LINE
// ที่ผู้ใช้บอกว่า "ไม่ได้รับ" นั้นระบบส่งไม่ผ่านจริง หรือส่งไปแล้วแต่ตกหล่นปลายทาง
//
// ปุ่มส่งซ้ำจะยิงอีเมล/LINE จริง จึงจำกัดจำนวนต่อครั้งและเปิดให้เฉพาะ admin (API ตรวจซ้ำอีกชั้น)

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface FailedRow {
    channel: string
    count: number
}

interface StatusResponse {
    failed: FailedRow[]
    totalFailed: number
    byStatus: { channel: string; status: string; count: number }[]
}

const CHANNEL_LABEL: Record<string, string> = {
    inapp: "ในระบบ",
    email: "อีเมล",
    line: "LINE",
}

const STATUS_LABEL: Record<string, string> = {
    sent: "ส่งสำเร็จ",
    failed: "ส่งไม่สำเร็จ",
    pending: "รอส่ง",
}

export default function DeliveryStatusCard() {
    const [data, setData] = useState<StatusResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [retrying, setRetrying] = useState(false)
    const [message, setMessage] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/notifications/retry")
            if (!res.ok) return
            setData((await res.json()) as StatusResponse)
        } catch {
            // การ์ดนี้เป็นข้อมูลประกอบ — โหลดไม่ได้ก็แสดงสถานะว่างไว้
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const retry = async () => {
        setRetrying(true)
        setMessage("")
        try {
            const res = await fetch("/api/notifications/retry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
            })
            if (!res.ok) {
                setMessage("ส่งซ้ำไม่สำเร็จ")
                return
            }
            const result = (await res.json()) as {
                attempted: number
                sent: number
                stillFailed: number
            }
            setMessage(
                `ลองส่งใหม่ ${result.attempted} รายการ — สำเร็จ ${result.sent} · ยังไม่สำเร็จ ${result.stillFailed}`
            )
            await load()
        } catch {
            setMessage("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setRetrying(false)
        }
    }

    const totalFailed = data?.totalFailed ?? 0

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">ผลการส่งแจ้งเตือน</CardTitle>
                    <Button variant="outline" size="icon" onClick={() => void load()}>
                        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                        <span className="sr-only">รีเฟรช</span>
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {loading && !data ? (
                    <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
                ) : !data || data.byStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        ยังไม่มีประวัติการส่งแจ้งเตือนในระบบ
                    </p>
                ) : (
                    <>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {data.byStatus.map((row) => (
                                <div
                                    key={`${row.channel}-${row.status}`}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                                >
                                    <p className="text-xs text-muted-foreground">
                                        {CHANNEL_LABEL[row.channel] ?? row.channel} ·{" "}
                                        {STATUS_LABEL[row.status] ?? row.status}
                                    </p>
                                    <p className="mt-1 text-lg font-semibold">{row.count}</p>
                                </div>
                            ))}
                        </div>

                        {totalFailed > 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
                                <p className="flex items-center gap-2 text-sm">
                                    <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                                    ส่งไม่สำเร็จ {totalFailed} รายการ (
                                    {data.failed
                                        .map(
                                            (f) =>
                                                `${CHANNEL_LABEL[f.channel] ?? f.channel} ${f.count}`
                                        )
                                        .join(" · ")}
                                    )
                                </p>
                                <Button onClick={() => void retry()} disabled={retrying} size="sm">
                                    {retrying ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                    ส่งซ้ำ (ครั้งละไม่เกิน 50)
                                </Button>
                            </div>
                        ) : (
                            <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                                <CheckCircle2 className="size-4" />
                                ไม่มีรายการที่ส่งไม่สำเร็จ
                            </p>
                        )}
                    </>
                )}

                {message && <p className="text-sm text-muted-foreground">{message}</p>}
            </CardContent>
        </Card>
    )
}
