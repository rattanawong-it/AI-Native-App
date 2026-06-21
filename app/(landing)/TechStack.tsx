export default function TechStack() {
    const techs = [
        "Next.js 16", "TypeScript", "Tailwind CSS", "Better Auth",
        "Prisma v7", "PostgreSQL", "pgVector", "OpenAI",
        "LINE API", "n8n", "Podman",
    ]

    return (
        <section id="tech-stack" className="py-24">
            <div className="mx-auto max-w-7xl px-6 text-center">
                <h2 className="mb-4 text-3xl font-bold tracking-tight">Tech Stack</h2>
                <p className="mb-12 text-muted-foreground">เทคโนโลยีที่ใช้ในโปรเจกต์</p>

                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4">
                    {techs.map((tech) => (
                        <span
                            key={tech}
                            className="rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    )
}