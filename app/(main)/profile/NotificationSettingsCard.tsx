"use client"

// การ์ด "การแจ้งเตือน" ในหน้าโปรไฟล์ (F8.7) + การผูกบัญชี LINE (F8.5)
//
// รูปแบบการ์ดและคลาสสีทำตาม `ProfileForm.tsx` เดิมของหน้านี้ ไม่ได้ใช้ชุด shadcn ของหน้า ITSM
// เพื่อให้หน้าโปรไฟล์ยังดูเป็นชุดเดียวกันทั้งหน้า

import { useCallback, useEffect, useState } from "react"
import {
    Bell,
    Mail,
    MessageCircle,
    Loader2,
    Link2,
    Link2Off,
    Copy,
    CheckCircle,
    AlertCircle,
} from "lucide-react"
import type { NotificationChannel, NotificationPrefsResponse } from "@/lib/notification-client-types"

/// ช่องทางที่ให้เปิด/ปิดได้ พร้อมคำอธิบายว่าปิดแล้วจะพลาดอะไร
const CHANNELS: {
    key: NotificationChannel
    label: string
    description: string
    icon: React.ReactNode
}[] = [
    {
        key: "inapp",
        label: "แจ้งเตือนในระบบ",
        description: "แสดงบนกระดิ่งมุมขวาบนของทุกหน้า",
        icon: <Bell className="w-4 h-4" />,
    },
    {
        key: "email",
        label: "อีเมล",
        description: "ส่งไปยังอีเมลที่ใช้เข้าสู่ระบบ",
        icon: <Mail className="w-4 h-4" />,
    },
    {
        key: "line",
        label: "LINE",
        description: "ส่งเข้าแชทส่วนตัวกับบอท ต้องผูกบัญชีก่อน",
        icon: <MessageCircle className="w-4 h-4" />,
    },
]

export default function NotificationSettingsCard() {
    const [prefs, setPrefs] = useState<Record<NotificationChannel, boolean> | null>(null)
    const [lineLinked, setLineLinked] = useState(false)
    const [savingKey, setSavingKey] = useState<NotificationChannel | null>(null)
    const [error, setError] = useState("")

    // ── การผูกบัญชี LINE ──
    const [bindCode, setBindCode] = useState("")
    const [bindLoading, setBindLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications/preferences")
            if (!res.ok) {
                setError("โหลดการตั้งค่าแจ้งเตือนไม่สำเร็จ")
                return
            }
            const data = (await res.json()) as NotificationPrefsResponse
            setPrefs(data.prefs)
            setLineLinked(data.lineLinked)
            setError("")
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    /// สลับค่าแล้วบันทึกทันที — อัปเดตหน้าจอก่อนให้สวิตช์ตอบสนองไว แล้วย้อนกลับถ้าพลาด
    const toggle = async (key: NotificationChannel) => {
        if (!prefs) return
        const next = !prefs[key]
        setSavingKey(key)
        setPrefs({ ...prefs, [key]: next })
        try {
            const res = await fetch("/api/notifications/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: next }),
            })
            if (!res.ok) {
                setPrefs({ ...prefs, [key]: !next })
                setError("บันทึกการตั้งค่าไม่สำเร็จ")
                return
            }
            const data = (await res.json()) as NotificationPrefsResponse
            setPrefs(data.prefs)
            setError("")
        } catch {
            setPrefs({ ...prefs, [key]: !next })
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSavingKey(null)
        }
    }

    const requestCode = async () => {
        setBindLoading(true)
        setCopied(false)
        try {
            const res = await fetch("/api/line/link", { method: "POST" })
            if (!res.ok) {
                setError("ขอรหัสผูกบัญชีไม่สำเร็จ")
                return
            }
            const data = (await res.json()) as { code: string }
            setBindCode(data.code)
            setError("")
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBindLoading(false)
        }
    }

    const unlink = async () => {
        setBindLoading(true)
        try {
            const res = await fetch("/api/line/link", { method: "DELETE" })
            if (!res.ok) {
                setError("ยกเลิกการผูกบัญชีไม่สำเร็จ")
                return
            }
            setLineLinked(false)
            setBindCode("")
            setError("")
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBindLoading(false)
        }
    }

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(`ผูกบัญชี ${bindCode}`)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // คัดลอกไม่ได้ก็ยังพิมพ์ตามจากหน้าจอได้
        }
    }

    return (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-500" />
                การแจ้งเตือน
            </h2>

            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── สวิตช์ช่องทาง (F8.7) ── */}
            <div className="space-y-4">
                {CHANNELS.map((channel) => {
                    const enabled = prefs?.[channel.key] ?? false
                    const lineWarning = channel.key === "line" && enabled && !lineLinked

                    return (
                        <div key={channel.key} className="flex items-start justify-between gap-4">
                            <div className="flex gap-3 min-w-0">
                                <span className="mt-0.5 text-muted-foreground">{channel.icon}</span>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                        {channel.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {channel.description}
                                    </p>
                                    {lineWarning && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                            เปิดไว้แล้วแต่ยังไม่ได้ผูกบัญชี LINE จึงยังส่งไม่ถึง
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={channel.label}
                                disabled={prefs === null || savingKey !== null}
                                onClick={() => void toggle(channel.key)}
                                className={`relative shrink-0 h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                                    enabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                                        enabled ? "translate-x-5.5" : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* ── ผูกบัญชี LINE (F8.5) ── */}
            <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground flex items-center gap-2">
                            บัญชี LINE
                            {lineLinked ? (
                                <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    ผูกแล้ว
                                </span>
                            ) : (
                                <span className="text-xs font-normal text-muted-foreground">
                                    ยังไม่ได้ผูก
                                </span>
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            ผูกแล้วจะรับแจ้งเตือนทาง LINE และแจ้งปัญหาผ่านแชทกับบอทได้
                        </p>
                    </div>

                    {lineLinked ? (
                        <button
                            onClick={() => void unlink()}
                            disabled={bindLoading}
                            className="flex shrink-0 items-center gap-2 px-3 py-2 border border-border hover:bg-accent disabled:opacity-50 text-foreground text-sm font-medium rounded-lg transition"
                        >
                            {bindLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Link2Off className="w-4 h-4" />
                            )}
                            ยกเลิกการผูก
                        </button>
                    ) : (
                        <button
                            onClick={() => void requestCode()}
                            disabled={bindLoading}
                            className="flex shrink-0 items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                        >
                            {bindLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Link2 className="w-4 h-4" />
                            )}
                            ขอรหัสผูกบัญชี
                        </button>
                    )}
                </div>

                {bindCode && !lineLinked && (
                    <div className="mt-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 p-4">
                        <p className="text-sm text-foreground">
                            เปิดแชทกับบอทใน LINE แล้วพิมพ์ข้อความนี้ (รหัสมีอายุ 10 นาที)
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-background border border-border px-3 py-2 font-mono text-sm">
                                ผูกบัญชี {bindCode}
                            </code>
                            <button
                                onClick={() => void copyCode()}
                                className="flex items-center gap-1.5 px-3 py-2 border border-border hover:bg-accent text-sm rounded-lg transition"
                            >
                                {copied ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            เมื่อผูกสำเร็จ บอทจะตอบกลับในแชท · กลับมากดรีเฟรชหน้านี้เพื่อดูสถานะ
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
