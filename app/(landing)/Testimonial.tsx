import { Star, Quote } from "lucide-react"

const testimonials = [
    {
        name: "วิทยา สมาร์ท",
        role: "Senior Developer",
        company: "TechCorp Thailand",
        quote: "หลักสูตรนี้ทำให้เข้าใจ AI-Native Development ได้อย่างลึกซึ้ง ทำโปรเจกต์จริงตั้งแต่วันแรก ใช้งานจริงได้เลยหลังเรียนจบ",
        rating: 5,
    },
    {
        name: "ปาริชาต ดิจิทัล",
        role: "Full Stack Developer",
        company: "Digital Innovation Co.",
        quote: "ชอบที่สอน RAG และ pgVector แบบเข้าใจง่าย ทำให้สร้าง Knowledge Base ได้จริงๆ เชื่อม LINE ได้ด้วย ประทับใจมาก",
        rating: 5,
    },
    {
        name: "ธนพล นวัตกรรม",
        role: "Tech Lead",
        company: "AI Solutions Ltd.",
        quote: "เนื้อหาครบวงจรตั้งแต่ Auth จนถึง Deploy ด้วย Podman ทีมงานนำไปใช้งานจริงในออฟฟิศได้ทันที ROI สูงมาก",
        rating: 5,
    },
]

export default function Testimonial() {
    return (
        <section id="testimonial" className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-16 text-center">
                    <h2 className="mb-4 text-3xl font-bold tracking-tight">
                        รีวิวจากผู้เรียน
                    </h2>
                    <p className="mx-auto max-w-2xl text-muted-foreground">
                        ความคิดเห็นจากนักพัฒนาที่ผ่านหลักสูตร AI-Native Developer Masterclass
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {testimonials.map((item) => (
                        <div
                            key={item.name}
                            className="relative rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-lg hover:border-purple-500/50"
                        >
                            {/* Quote Icon */}
                            <Quote className="absolute right-6 top-6 h-8 w-8 text-purple-100 dark:text-purple-900/50" />

                            {/* Stars */}
                            <div className="mb-4 flex gap-1">
                                {Array.from({ length: item.rating }).map((_, i) => (
                                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                ))}
                            </div>

                            {/* Quote */}
                            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                                &ldquo;{item.quote}&rdquo;
                            </p>

                            {/* Author */}
                            <div className="border-t pt-4">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {item.role} — {item.company}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}