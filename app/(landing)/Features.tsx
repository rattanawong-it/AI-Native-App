import { Bot, Shield, Database, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const features = [
    {
        icon: Shield,
        title: "Secure Authentication",
        description: "Better Auth with Social Login, MFA, RBAC — ระบบยืนยันตัวตนที่ปลอดภัยและทันสมัย",
    },
    {
        icon: Database,
        title: "RAG Knowledge Base",
        description: "สร้างฐานความรู้ AI ด้วย pgVector และ OpenAI Embeddings — ค้นหาข้อมูลจากความหมาย",
    },
    {
        icon: Bot,
        title: "AI Chatbot",
        description: "Chatbot อัจฉริยะที่ตอบคำถามจากเอกสารองค์กร — รองรับ Web และ LINE",
    },
    {
        icon: Zap,
        title: "Automation & Deploy",
        description: "Workflow Automation ด้วย n8n และ Container Deployment ด้วย Podman",
    },
]

export default function Features() {
    return (
        <section id="features" className="border-t bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-16 text-center">
                    <h2 className="mb-4 text-3xl font-bold tracking-tight">
                        ฟีเจอร์หลัก
                    </h2>
                    <p className="mx-auto max-w-2xl text-muted-foreground">
                        เทคโนโลยีที่ทันสมัยและครบวงจร สำหรับการสร้าง AI-Native Application
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {features.map((feature) => (
                        <Card key={feature.title} className="group transition-all hover:shadow-lg hover:border-purple-500/50">
                            <CardHeader>
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/30">
                                    <feature.icon className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-lg">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}