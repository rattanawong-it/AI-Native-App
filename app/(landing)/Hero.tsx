import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Hero() {
    return (
        <section id="home" className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-14">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 h-150 w-225 rounded-full bg-purple-500/10 blur-3xl" />
                <div className="absolute right-0 top-1/3 h-100 w-100 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <div className="mx-auto max-w-4xl text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm shadow-sm backdrop-blur-sm">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span>Powered by Next.js 16 &amp; Better Auth</span>
                </div>

                <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                    <span className="bg-linear-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                        AI-Native
                    </span>{" "}
                    Application
                </h1>

                <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
                    สร้างแอปพลิเคชัน AI ครบวงจร — ตั้งแต่ระบบ Authentication ที่ปลอดภัย,
                    RAG Chatbot อัจฉริยะ, LINE Integration ไปจนถึง Production Deployment
                </p>

                <div className="flex items-center justify-center gap-4">
                    <Link href="/auth/signup">
                        <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8">
                            เริ่มต้นใช้งาน
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/auth/signin">
                        <Button variant="outline" size="lg" className="px-8">
                            เข้าสู่ระบบ
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    )
}