import { Github, Linkedin } from "lucide-react"

const teamMembers = [
    {
        name: "อ.สามิตร โกยม",
        role: "Lead Instructor & Developer",
        bio: "Full-Stack Developer & AI Enthusiast — ผู้สอนหลักสูตร Next.js 16: The AI-Native Developer Masterclass",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&q=80",
        github: "#",
        linkedin: "#",
    },
    {
        name: "ดร.ปัญญา ศิลป์",
        role: "AI Research Advisor",
        bio: "ที่ปรึกษาด้าน AI & Machine Learning — เชี่ยวชาญด้าน NLP, RAG Architecture และ Vector Databases",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80",
        github: "#",
        linkedin: "#",
    },
    {
        name: "คุณนภา ดิจิทัล",
        role: "UX/UI Designer",
        bio: "ออกแบบ User Experience ที่สวยงามและใช้งานง่าย — เชี่ยวชาญด้าน Design System และ Accessibility",
        avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&q=80",
        github: "#",
        linkedin: "#",
    },
]

export default function Team() {
    return (
        <section id="team" className="border-t bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-16 text-center">
                    <h2 className="mb-4 text-3xl font-bold tracking-tight">ทีมงาน</h2>
                    <p className="mx-auto max-w-2xl text-muted-foreground">
                        ทีมผู้พัฒนาและผู้สอนที่อยู่เบื้องหลังหลักสูตร AI-Native Developer Masterclass
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {teamMembers.map((member) => (
                        <div
                            key={member.name}
                            className="group rounded-xl border bg-card p-6 text-center shadow-sm transition-all hover:shadow-lg hover:border-purple-500/50"
                        >
                            {/* Avatar */}
                            <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full ring-2 ring-purple-500/20 ring-offset-2 ring-offset-background transition-all group-hover:ring-purple-500/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={member.avatar}
                                    alt={member.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            {/* Info */}
                            <h3 className="mb-1 text-lg font-semibold">{member.name}</h3>
                            <p className="mb-3 text-sm font-medium text-purple-600 dark:text-purple-400">
                                {member.role}
                            </p>
                            <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                                {member.bio}
                            </p>

                            {/* Social Links */}
                            <div className="flex items-center justify-center gap-3">
                                <a
                                    href={member.github}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label={`${member.name} GitHub`}
                                >
                                    <Github className="h-4 w-4" />
                                </a>
                                <a
                                    href={member.linkedin}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label={`${member.name} LinkedIn`}
                                >
                                    <Linkedin className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}