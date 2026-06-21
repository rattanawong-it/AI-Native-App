"use client"

import { useSession, authClient } from "@/lib/auth-client"

export function ImpersonationBanner() {
    const { data: session } = useSession()

    // impersonatedBy อยู่ใน session object (ไม่ใช่ user)
    const isImpersonating = !!(
        session?.session as { impersonatedBy?: string } | undefined
    )?.impersonatedBy

    if (!isImpersonating) return null

    const handleStopImpersonating = async () => {
        try {
            await authClient.admin.stopImpersonating()
            window.location.href = "/admin/users"
        } catch {
            console.error("Stop impersonating failed")
        }
    }

    return (
        <div className="flex items-center justify-between bg-amber-500 dark:bg-amber-600 px-4 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-950 dark:text-amber-50">
                <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <span>
                    กำลังเข้าใช้งานในนามของ{" "}
                    <strong>{session?.user?.name}</strong> (Impersonating)
                </span>
            </div>
            <button
                onClick={handleStopImpersonating}
                className="rounded-md bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900 transition-colors cursor-pointer"
            >
                หยุด Impersonate
            </button>
        </div>
    )
}