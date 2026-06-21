import { Code, Users, Lightbulb } from "lucide-react"

export default function About() {
    const highlights = [
        {
            icon: Lightbulb,
            title: "AI-First Approach",
            description: "ออกแบบโดยมี AI เป็นหัวใจหลัก ตั้งแต่ RAG, Embeddings ไปจนถึง Chatbot อัจฉริยะ",
        },
        {
            icon: Code,
            title: "Modern Stack",
            description: "ใช้เทคโนโลยีล่าสุด — Next.js 16, Prisma v7, Better Auth และ pgVector",
        },
        {
            icon: Users,
            title: "Production Ready",
            description: "พร้อม Deploy ด้วย Container, Workflow Automation และ LINE Integration",
        },
    ]

    return (
        <section id="about" className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    {/* Left - Text */}
                    <div>
                        <h2 className="mb-4 text-3xl font-bold tracking-tight">
                            เกี่ยวกับ{" "}
                            <span className="bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                AI Native App
                            </span>
                        </h2>
                        <p className="mb-6 text-muted-foreground leading-relaxed">
                            AI Native App คือโปรเจกต์ต้นแบบที่พัฒนาจากหลักสูตร
                            &quot;Next.js 16: The AI-Native Developer Masterclass&quot;
                            ครอบคลุมการสร้างแอปพลิเคชันครบวงจรตั้งแต่ Authentication,
                            RAG Knowledge Base, AI Chatbot ไปจนถึง LINE Integration
                            และ Production Deployment
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            เหมาะสำหรับนักพัฒนาที่ต้องการเรียนรู้การสร้าง AI Application
                            ด้วยเทคโนโลยียุคใหม่แบบ hands-on ทำจริงทุกขั้นตอน
                        </p>
                    </div>

                    {/* Right - Highlights */}
                    <div className="space-y-6">
                        {highlights.map((item) => (
                            <div key={item.title} className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                                    <item.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="mb-1 font-semibold">{item.title}</h3>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}