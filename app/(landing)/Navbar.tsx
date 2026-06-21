"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { themeStore } from "@/lib/theme-store"

const navLinks = [
    { href: "/#home", label: "หน้าแรก" },
    { href: "/#features", label: "ฟีเจอร์" },
    { href: "/#about", label: "เกี่ยวกับเรา" },
    { href: "/#team", label: "ทีมงาน" },
    { href: "/#testimonial", label: "รีวิว" },
    { href: "/#lead", label: "สนใจบริการ" },
]
function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

    return (
        <header className="fixed left-0 top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
                {/* Logo */}
                <Link href="/#home" className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="text-lg font-bold">AI Native App</span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleDarkMode}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Toggle theme"
                    >
                        {/* Moon icon (light mode) */}
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-4.5 w-4.5 transition-all ${isDarkMode ? 'hidden' : 'block'}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                        {/* Sun icon (dark mode) */}
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-4.5 w-4.5 transition-all ${isDarkMode ? 'block' : 'hidden'}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    </button>

                    <Link href="/auth/signin">
                        <Button variant="ghost" size="sm">
                            เข้าสู่ระบบ
                        </Button>
                    </Link>
                    <Link href="/auth/signup">
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                            เริ่มต้นใช้งาน
                        </Button>
                    </Link>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="text-muted-foreground flex h-9 w-9 items-center justify-center lg:hidden"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? (
                            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                                <path d="M16.5 5.5L5.5 16.5M5.5 5.5L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 22 22" className="fill-current">
                                <path d="M2.75 3.66666H19.25V5.49999H2.75V3.66666ZM2.75 10.0833H19.25V11.9167H2.75V10.0833ZM2.75 16.5H19.25V18.3333H2.75V16.5Z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden border-t bg-background/95 backdrop-blur-md">
                    <nav className="mx-auto max-w-7xl px-6 py-4 space-y-3">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    )
}

export default Navbar