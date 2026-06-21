import Link from "next/link"
import { Sparkles } from "lucide-react"

export default function Footer() {
    return (
        <footer className="border-t bg-muted/30 py-12">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid gap-8 md:grid-cols-3">
                    {/* Brand */}
                    <div>
                        <div className="mb-3 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            <span className="text-lg font-bold">AI Native App</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            AI-Native Application สร้างจากหลักสูตร
                            Next.js 16: The AI-Native Developer Masterclass
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <h3 className="mb-3 font-semibold">ลิงก์ด่วน</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/#features" className="hover:text-foreground transition-colors">
                                    ฟีเจอร์
                                </Link>
                            </li>
                            <li>
                                <Link href="/#about" className="hover:text-foreground transition-colors">
                                    เกี่ยวกับเรา
                                </Link>
                            </li>
                            <li>
                                <Link href="/#team" className="hover:text-foreground transition-colors">
                                    ทีมงาน
                                </Link>
                            </li>
                            <li>
                                <Link href="/auth/signin" className="hover:text-foreground transition-colors">
                                    เข้าสู่ระบบ
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="mb-3 font-semibold">ติดต่อ</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>IT Genius Engineering</li>
                            <li>อ.สามิตร โกยม</li>
                            <li>
                                <a href="https://www.itgenius.co.th" className="text-purple-500 hover:text-purple-400 transition-colors">
                                    www.itgenius.co.th
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
                    <p>© 2026 AI Native App — Next.js 16: The AI-Native Developer Masterclass</p>
                    <p className="mt-1">โดย อ.สามิตร โกยม (IT Genius Engineering)</p>
                </div>
            </div>
        </footer>
    )
}