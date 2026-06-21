"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { MailCheck, Loader2, AlertCircle, Sparkles } from "lucide-react"
import Link from "next/link"

export default function VerifyEmailPage() {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        // อ่าน token จาก URL query parameter
        const params = new URLSearchParams(window.location.search)
        const token = params.get("token")

        if (!token) {
            setStatus("error")
            setErrorMessage("ไม่พบ Token สำหรับยืนยันอีเมล")
            return
        }

        // เรียก Better Auth verify email
        authClient.verifyEmail({ query: { token } }).then((res) => {
            if (res.error) {
                setStatus("error")
                setErrorMessage(res.error.message || "ไม่สามารถยืนยันอีเมลได้")
            } else {
                setStatus("success")
            }
        }).catch(() => {
            setStatus("error")
            setErrorMessage("เกิดข้อผิดพลาดในการยืนยันอีเมล")
        })
    }, [])

    return (
        <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                <span className="text-xl font-bold">AI Native App</span>
            </div>

            {status === "loading" && (
                <div className="flex flex-col items-center space-y-4 text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                    <h1 className="text-2xl font-semibold tracking-tight">
                        กำลังยืนยันอีเมล...
                    </h1>
                    <p className="text-sm text-muted-foreground">กรุณารอสักครู่</p>
                </div>
            )}

            {status === "success" && (
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                        <MailCheck className="h-8 w-8 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        ยืนยันอีเมลสำเร็จ!
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        อีเมลของคุณได้รับการยืนยันเรียบร้อยแล้ว
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                    >
                        ไปหน้า Dashboard
                    </Link>
                </div>
            )}

            {status === "error" && (
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        ยืนยันอีเมลไม่สำเร็จ
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {errorMessage}
                    </p>
                    <Link
                        href="/profile"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                    >
                        กลับไปหน้าโปรไฟล์
                    </Link>
                </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
                <Link
                    href="/auth/signin"
                    className="font-medium text-purple-500 hover:text-purple-400"
                >
                    กลับไปหน้าเข้าสู่ระบบ
                </Link>
            </p>
        </div>
    )
}