"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sparkles, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export default function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState(token ? "" : "ลิงก์ไม่ถูกต้องหรือหมดอายุ")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (password.length < 8) {
            setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
            return
        }

        if (password !== confirmPassword) {
            setError("รหัสผ่านไม่ตรงกัน")
            return
        }

        setIsLoading(true)

        try {
            const res = await authClient.resetPassword({
                newPassword: password,
                token: token!,
            })

            if (res.error) {
                setError(res.error.message || "เกิดข้อผิดพลาด")
            } else {
                setIsSuccess(true)
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่")
        } finally {
            setIsLoading(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="space-y-6">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                    <span className="text-xl font-bold">AI Native App</span>
                </div>

                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        ตั้งรหัสผ่านใหม่สำเร็จ!
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว
                    </p>
                </div>

                <Link href="/auth/signin">
                    <Button className="w-full bg-purple-600 py-5 text-white hover:bg-purple-700">
                        ไปหน้าเข้าสู่ระบบ
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                <span className="text-xl font-bold">AI Native App</span>
            </div>

            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    ตั้งรหัสผ่านใหม่
                </h1>
                <p className="text-sm text-muted-foreground">
                    กรอกรหัสผ่านใหม่ของคุณ
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="password">รหัสผ่านใหม่</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="อย่างน้อย 8 ตัวอักษร"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
                    <div className="relative">
                        <Input
                            id="confirm-password"
                            type={showConfirm ? "text" : "password"}
                            placeholder="กรอกรหัสผ่านอีกครั้ง"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={8}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                        >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full bg-purple-600 py-5 text-white hover:bg-purple-700"
                    disabled={isLoading}
                >
                    {isLoading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
                </Button>
            </form>

            {/* Back to Sign In */}
            <p className="text-center text-sm text-muted-foreground">
                <Link
                    href="/auth/signin"
                    className="inline-flex items-center gap-1 font-medium text-purple-500 hover:text-purple-400"
                >
                    <ArrowLeft className="h-4 w-4" />
                    กลับไปหน้าเข้าสู่ระบบ
                </Link>
            </p>
        </div>
    )
}