"use client"

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react"
import { useSession, signOut } from "@/lib/auth-client"
import { themeStore } from "@/lib/theme-store"
import Image from "next/image"
import Link from "next/link"

export default function UserMenu() {
    const { data: session, isPending } = useSession()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Dark mode
    const isDarkMode = useSyncExternalStore(
        themeStore.subscribe,
        themeStore.getSnapshot,
        themeStore.getServerSnapshot
    )

    useEffect(() => {
        themeStore.initTheme()
    }, [])

    const toggleDarkMode = useCallback(() => {
        themeStore.setTheme(!isDarkMode)
    }, [isDarkMode])

    // ปิด dropdown เมื่อคลิกข้างนอก
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // กำลังโหลด Session
    if (isPending) {
        return <div className="animate-pulse w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full" />
    }

    // ยังไม่ได้ Login
    if (!session) {
        return null
    }

    // สร้าง Avatar Initials จากชื่อผู้ใช้
    const initials = (session.user?.name || "U")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)

    return (
        <div className="relative flex items-center gap-2" ref={menuRef}>
            {/* Theme Toggle Button */}
            <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition"
                aria-label="Toggle theme"
            >
                {isDarkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                )}
            </button>

            {/* Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition pl-3 pr-1.5 py-1.5"
            >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block">
                    {session.user?.name}
                </span>

                {session.user?.image ? (
                    <Image
                        src={session.user.image}
                        alt="Avatar"
                        className="w-9 h-9 rounded-full ring-2 ring-gray-100 dark:ring-gray-700"
                        width={36}
                        height={36}
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center ring-2 ring-purple-100 dark:ring-purple-900">
                        <span className="text-xs font-bold text-white">{initials}</span>
                    </div>
                )}

                {/* Chevron */}
                <svg
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{session.user?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.user?.email}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                            {(session.user as { role?: string })?.role?.toUpperCase() || "USER"}
                        </span>
                    </div>

                    {/* Profile Link */}
                    <div className="px-2 pt-2">
                        <Link
                            href="/profile"
                            onClick={() => setIsOpen(false)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 rounded-xl transition font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            โปรไฟล์ของฉัน
                        </Link>
                    </div>

                    {/* Logout */}
                    <div className="px-2 pt-1 pb-1">
                        <button
                            onClick={async () => {
                                await signOut({
                                    fetchOptions: {
                                        onSuccess: () => {
                                            window.location.href = "/auth/signin"
                                        },
                                    },
                                })
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            ออกจากระบบ
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}