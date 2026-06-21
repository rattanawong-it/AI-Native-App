"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { ShieldCheck, Loader2, AlertCircle, KeyRound } from "lucide-react"
import Link from "next/link"

export default function Verify2FAPage() {
    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [useBackupCode, setUseBackupCode] = useState(false)

    const handleVerifyTotp = async () => {
        if (!code) {
            setError("กรุณากรอกรหัส")
            return
        }

        setLoading(true)
        setError("")

        try {
            const res = await authClient.twoFactor.verifyTotp({
                code,
                trustDevice: true,
            })

            if (res.error) {
                if(res.error.code === "INVALID_CODE") {
                    setError("รหัส 2FA ไม่ถูกต้อง")
                    return
                }
                setError(res.error.message || "รหัสไม่ถูกต้อง")
            } else {
                window.location.href = "/dashboard"
            }
        } catch {
            setError("เกิดข้อผิดพลาด")
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyBackupCode = async () => {
        if (!code) {
            setError("กรุณากรอก Backup Code")
            return
        }

        setLoading(true)
        setError("")

        try {
            const res = await authClient.twoFactor.verifyBackupCode({
                code,
                trustDevice: true,
            })

            if (res.error) {
                if(res.error.code === "INVALID_BACKUP_CODE") {
                    setError("Backup Code ไม่ถูกต้อง")
                    return
                }
                setError(res.error.message || "Backup Code ไม่ถูกต้อง")
            } else {
                window.location.href = "/dashboard"
            }
        } catch {
            setError("เกิดข้อผิดพลาด")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
            <div className="max-w-md w-full p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
                <div className="text-center mb-6">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                        {useBackupCode ? (
                            <KeyRound className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                        ) : (
                            <ShieldCheck className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {useBackupCode ? "Backup Code" : "ยืนยันตัวตน 2FA"}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {useBackupCode
                            ? "กรอก Backup Code ที่คุณบันทึกไว้"
                            : "กรอกรหัส 6 หลักจากแอป Authenticator"
                        }
                    </p>
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                            if (useBackupCode) {
                                setCode(e.target.value)
                            } else {
                                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                        }}
                        placeholder={useBackupCode ? "Backup Code" : "000000"}
                        maxLength={useBackupCode ? 20 : 6}
                        autoFocus
                        className="w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-foreground text-center tracking-[0.3em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                useBackupCode ? handleVerifyBackupCode() : handleVerifyTotp()
                            }
                        }}
                    />

                    <button
                        onClick={useBackupCode ? handleVerifyBackupCode : handleVerifyTotp}
                        disabled={loading || !code}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
                    </button>

                    <div className="text-center">
                        <button
                            onClick={() => { setUseBackupCode(!useBackupCode); setCode(""); setError("") }}
                            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                        >
                            {useBackupCode ? "ใช้รหัสจากแอป Authenticator แทน" : "ใช้ Backup Code แทน"}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link href="/auth/signin" className="text-sm text-muted-foreground hover:text-foreground transition">
                            กลับไปหน้าเข้าสู่ระบบ
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}