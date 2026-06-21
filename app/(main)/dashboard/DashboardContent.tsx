import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Shield,
    Bot,
    Database,
    Sparkles,
    Users,
    FileText,
    MessageSquare,
    Activity,
    ArrowUpRight,
    Clock,
    FolderOpen,
    Zap,
    TrendingUp,
    Server,
} from "lucide-react"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function DashboardContent() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session) {
        return null
    }

    const isAdmin = session.user.role === "admin"

    // ─── Fetch Real Stats ────────────────────────────────
    const [
        totalUsers,
        totalDocuments,
        indexedDocuments,
        totalChatSessions,
        totalMessages,
        recentSessions,
        recentDocuments,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.knowledgeDocument.count(),
        prisma.knowledgeDocument.count({ where: { isIndexed: true } }),
        prisma.chatSession.count({ where: { userId: session.user.id } }),
        prisma.chatMessage.count({
            where: { session: { userId: session.user.id } },
        }),
        prisma.chatSession.findMany({
            where: { userId: session.user.id },
            orderBy: { updatedAt: "desc" },
            take: 5,
            include: { _count: { select: { messages: true } } },
        }),
        prisma.knowledgeDocument.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
    ])

    // ─── Stats Cards ─────────────────────────────────────
    const stats = [
        {
            title: "สถานะบัญชี",
            value: isAdmin ? "Admin" : session.user.role === "manager" ? "Manager" : "User",
            icon: Shield,
            description: `เข้าสู่ระบบในชื่อ ${session.user.name}`,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-50 dark:bg-purple-900/20",
        },
        {
            title: "Knowledge Docs",
            value: totalDocuments.toString(),
            icon: Database,
            description: `${indexedDocuments} เอกสารถูก Index แล้ว`,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
        },
        {
            title: "AI Chat Sessions",
            value: totalChatSessions.toString(),
            icon: Bot,
            description: `${totalMessages} ข้อความทั้งหมด`,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-900/20",
        },
        ...(isAdmin
            ? [
                  {
                      title: "ผู้ใช้ทั้งหมด",
                      value: totalUsers.toString(),
                      icon: Users,
                      description: "ผู้ใช้ในระบบ",
                      color: "text-amber-600 dark:text-amber-400",
                      bg: "bg-amber-50 dark:bg-amber-900/20",
                  },
              ]
            : [
                  {
                      title: "สถานะระบบ",
                      value: "Active",
                      icon: Sparkles,
                      description: "ระบบทำงานปกติ",
                      color: "text-amber-600 dark:text-amber-400",
                      bg: "bg-amber-50 dark:bg-amber-900/20",
                  },
              ]),
    ]

    // ─── Quick Actions ───────────────────────────────────
    const quickActions = [
        {
            title: "AI Chat",
            description: "เริ่มสนทนากับ AI ที่เชื่อมต่อ Knowledge Base",
            href: "/chat",
            icon: MessageSquare,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            border: "border-blue-200 dark:border-blue-800",
        },
        ...(isAdmin
            ? [
                  {
                      title: "Knowledge Base",
                      description: "เพิ่มเอกสารและ Index ข้อมูลให้ AI",
                      href: "/admin/knowledge",
                      icon: FolderOpen,
                      color: "text-emerald-600 dark:text-emerald-400",
                      bg: "bg-emerald-50 dark:bg-emerald-900/20",
                      border: "border-emerald-200 dark:border-emerald-800",
                  },
              ]
            : [
                  {
                      title: "โปรไฟล์",
                      description: "ดูและแก้ไขข้อมูลส่วนตัว",
                      href: "/profile",
                      icon: FolderOpen,
                      color: "text-emerald-600 dark:text-emerald-400",
                      bg: "bg-emerald-50 dark:bg-emerald-900/20",
                      border: "border-emerald-200 dark:border-emerald-800",
                  },
              ]),
        {
            title: "จัดการทีม",
            description: "ดูสมาชิกและจัดการทีมงาน",
            href: "/management/teams",
            icon: Users,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            border: "border-purple-200 dark:border-purple-800",
        },
        ...(isAdmin
            ? [
                  {
                      title: "ตั้งค่าระบบ",
                      description: "กำหนดค่า AI Model, SMTP และอื่นๆ",
                      href: "/admin/settings",
                      icon: Activity,
                      color: "text-amber-600 dark:text-amber-400",
                      bg: "bg-amber-50 dark:bg-amber-900/20",
                      border: "border-amber-200 dark:border-amber-800",
                  },
              ]
            : [
                  {
                      title: "ช่วยเหลือ",
                      description: "FAQ, คู่มือและคำถามที่พบบ่อย",
                      href: "/help",
                      icon: Activity,
                      color: "text-amber-600 dark:text-amber-400",
                      bg: "bg-amber-50 dark:bg-amber-900/20",
                      border: "border-amber-200 dark:border-amber-800",
                  },
              ]),
    ]

    return (
        <div className="space-y-6">
            {/* ─── Header ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        สวัสดี, {session.user.name} 👋
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        ยินดีต้อนรับสู่ AI Native App Dashboard
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("th-TH", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </div>
            </div>

            {/* ─── Stats Grid ─────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="transition-shadow hover:shadow-md">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                                    <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                                        {stat.value}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {stat.description}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ─── Quick Actions ──────────────────────── */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Quick Actions
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {quickActions.map((action) => {
                        const Icon = action.icon
                        return (
                            <Link key={action.title} href={action.href}>
                                <Card
                                    className={`group cursor-pointer transition-all hover:shadow-md border ${action.border}`}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${action.bg} shrink-0`}>
                                                <Icon className={`h-4 w-4 ${action.color}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {action.title}
                                                    </p>
                                                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                    {action.description}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* ─── Two Column: Recent Chats + Recent Docs ─ */}
            <div className="grid gap-5 lg:grid-cols-2">
                {/* Recent Chat Sessions */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-blue-500" />
                                    การสนทนาล่าสุด
                                </CardTitle>
                                <CardDescription>Chat Sessions ที่อัปเดตล่าสุด</CardDescription>
                            </div>
                            <Link
                                href="/chat"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                                ดูทั้งหมด
                                <ArrowUpRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {recentSessions.length === 0 ? (
                            <div className="text-center py-8">
                                <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการสนทนา</p>
                                <Link
                                    href="/chat"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                                >
                                    เริ่มสนทนาใหม่ →
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentSessions.map((s) => (
                                    <Link key={s.id} href="/chat" className="block">
                                        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                                <MessageSquare className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {s.title || "Untitled Chat"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {s._count.messages} ข้อความ ·{" "}
                                                    {new Date(s.updatedAt).toLocaleDateString("th-TH", {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Knowledge Documents */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-emerald-500" />
                                    เอกสารล่าสุด
                                </CardTitle>
                                <CardDescription>Knowledge Base ที่เพิ่มล่าสุด</CardDescription>
                            </div>
                            <Link
                                href={isAdmin ? "/admin/knowledge" : "/chat"}
                                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                                ดูทั้งหมด
                                <ArrowUpRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {recentDocuments.length === 0 ? (
                            <div className="text-center py-8">
                                <Database className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">ยังไม่มีเอกสารใน Knowledge Base</p>
                                <Link
                                    href={isAdmin ? "/admin/knowledge" : "/chat"}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 inline-block"
                                >
                                    เพิ่มเอกสาร →
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentDocuments.map((doc) => (
                                    <Link key={doc.id} href={isAdmin ? "/admin/knowledge" : "#"} className="block">
                                        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                                                <FileText className="h-4 w-4 text-emerald-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {doc.title}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    {doc.fileType && (
                                                        <span className="uppercase font-medium">
                                                            {doc.fileType}
                                                        </span>
                                                    )}
                                                    <span>·</span>
                                                    <span>
                                                        {new Date(doc.createdAt).toLocaleDateString("th-TH", {
                                                            month: "short",
                                                            day: "numeric",
                                                        })}
                                                    </span>
                                                    {doc.isIndexed ? (
                                                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                                            <TrendingUp className="h-3 w-3" />
                                                            Indexed
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-600 dark:text-amber-400">Pending</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ─── System Info (Admin Only) ────────────── */}
            {isAdmin && (
                <Card className="border-dashed">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Server className="h-4 w-4 text-gray-500" />
                            ข้อมูลระบบ
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {[
                                { label: "Next.js", value: "16.1.6" },
                                { label: "React", value: "19.x" },
                                { label: "Prisma", value: "7.4.1" },
                                { label: "AI Model", value: "GPT-4o Mini" },
                                { label: "Embedding", value: "3-small" },
                                { label: "Vector DB", value: "pgVector" },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex items-center justify-between sm:flex-col sm:items-start gap-1 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                                >
                                    <span className="text-xs text-muted-foreground">{item.label}</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}