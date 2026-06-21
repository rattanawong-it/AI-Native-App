"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Folder,
  BarChart3,
  X,
  Loader2,
} from "lucide-react"

// ประเภทข้อมูล
type ProjectStatus = "active" | "completed" | "on-hold" | "planning"
type ProjectPriority = "high" | "medium" | "low"

interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  progress: number
  members: number
  tasks: { total: number; completed: number }
  dueDate: string
  updatedAt: string
  tags: string[]
}

// ข้อมูลตัวอย่าง
const SAMPLE_PROJECTS: Project[] = [
  {
    id: "1",
    name: "AI Chatbot Platform",
    description: "พัฒนาระบบ AI Chatbot สำหรับตอบคำถามลูกค้าแบบอัตโนมัติด้วย RAG",
    status: "active",
    priority: "high",
    progress: 65,
    members: 4,
    tasks: { total: 24, completed: 16 },
    dueDate: "2026-04-15",
    updatedAt: "2026-03-01",
    tags: ["AI", "NLP", "Next.js"],
  },
  {
    id: "2",
    name: "Knowledge Base Management",
    description: "ระบบจัดการฐานความรู้สำหรับ AI ใช้ในการตอบคำถาม",
    status: "active",
    priority: "medium",
    progress: 80,
    members: 3,
    tasks: { total: 18, completed: 14 },
    dueDate: "2026-03-20",
    updatedAt: "2026-03-02",
    tags: ["Vector DB", "Prisma"],
  },
  {
    id: "3",
    name: "LINE Bot Integration",
    description: "เชื่อมต่อระบบ Chat กับ LINE Official Account",
    status: "planning",
    priority: "high",
    progress: 10,
    members: 2,
    tasks: { total: 12, completed: 1 },
    dueDate: "2026-05-01",
    updatedAt: "2026-02-28",
    tags: ["LINE", "Webhook", "API"],
  },
  {
    id: "4",
    name: "User Analytics Dashboard",
    description: "สร้าง Dashboard แสดงสถิติการใช้งานระบบ AI",
    status: "on-hold",
    priority: "low",
    progress: 30,
    members: 2,
    tasks: { total: 15, completed: 5 },
    dueDate: "2026-06-01",
    updatedAt: "2026-02-20",
    tags: ["Chart", "Analytics"],
  },
  {
    id: "5",
    name: "E-commerce Product Recommendation",
    description: "ระบบแนะนำสินค้าด้วย AI สำหรับร้านค้าออนไลน์",
    status: "completed",
    priority: "medium",
    progress: 100,
    members: 5,
    tasks: { total: 30, completed: 30 },
    dueDate: "2026-02-28",
    updatedAt: "2026-02-28",
    tags: ["ML", "Recommendation"],
  },
  {
    id: "6",
    name: "Multi-language Support",
    description: "เพิ่มระบบรองรับหลายภาษาสำหรับ Chatbot (TH, EN, ZH, JP)",
    status: "planning",
    priority: "medium",
    progress: 5,
    members: 3,
    tasks: { total: 20, completed: 1 },
    dueDate: "2026-07-01",
    updatedAt: "2026-03-01",
    tags: ["i18n", "AI"],
  },
]

// สี/สไตล์ตาม status
const statusConfig: Record<
  ProjectStatus,
  { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }
> = {
  active: {
    label: "Active",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: ArrowUpRight,
  },
  completed: {
    label: "Completed",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: CheckCircle2,
  },
  "on-hold": {
    label: "On Hold",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: Clock,
  },
  planning: {
    label: "Planning",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: AlertCircle,
  },
}

const priorityConfig: Record<ProjectPriority, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-red-500" },
  medium: { label: "Medium", dot: "bg-amber-500" },
  low: { label: "Low", dot: "bg-green-500" },
}

export default function ProjectContent() {
  const [projects] = useState<Project[]>(SAMPLE_PROJECTS)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all")
  const [showNewModal, setShowNewModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: "", description: "" })
  const [isSaving, setIsSaving] = useState(false)

  // กรองโปรเจกต์
  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = filterStatus === "all" || p.status === filterStatus
    return matchSearch && matchStatus
  })

  // สถิติรวม
  const stats = [
    {
      label: "ทั้งหมด",
      value: projects.length,
      icon: Folder,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "กำลังดำเนินการ",
      value: projects.filter((p) => p.status === "active").length,
      icon: ArrowUpRight,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "เสร็จแล้ว",
      value: projects.filter((p) => p.status === "completed").length,
      icon: CheckCircle2,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "ภาพรวม Progress",
      value: `${Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)}%`,
      icon: BarChart3,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
  ]

  function handleCreateProject() {
    if (!newProject.name.trim()) return
    setIsSaving(true)
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      setShowNewModal(false)
      setNewProject({ name: "", description: "" })
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Projects
          </h2>
          <p className="text-muted-foreground mt-1">
            จัดการโปรเจกต์ AI ทั้งหมดของคุณ
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
        >
          <Plus className="h-4 w-4" />
          สร้างโปรเจกต์ใหม่
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ค้นหาโปรเจกต์..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "active", "completed", "on-hold", "planning"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === status
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {status === "all"
                ? "ทั้งหมด"
                : statusConfig[status].label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ไม่พบโปรเจกต์</h3>
          <p className="text-muted-foreground mt-1">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status]
            const priority = priorityConfig[project.priority]
            const StatusIcon = status.icon
            return (
              <Card
                key={project.id}
                className="group hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${priority.dot}`} />
                          {priority.label}
                        </span>
                      </div>
                      <CardTitle className="text-base truncate">{project.name}</CardTitle>
                    </div>
                    <button className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {project.description}
                  </p>
                </CardHeader>

                <CardContent className="pb-3">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          project.progress === 100
                            ? "bg-blue-500"
                            : project.progress >= 60
                            ? "bg-emerald-500"
                            : project.progress >= 30
                            ? "bg-amber-500"
                            : "bg-purple-500"
                        }`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Tasks summary */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {project.tasks.completed}/{project.tasks.total} Tasks
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{project.members} คน</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-t dark:border-gray-700 pt-3 pb-4 px-6 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      กำหนด {new Date(project.dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {project.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 2 && (
                      <span className="text-xs px-1.5 py-0.5 text-muted-foreground">
                        +{project.tags.length - 2}
                      </span>
                    )}
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowNewModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                สร้างโปรเจกต์ใหม่
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อโปรเจกต์
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  placeholder="เช่น AI Chatbot for E-commerce"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y text-sm"
                  placeholder="อธิบายเป้าหมายและขอบเขตของโปรเจกต์..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewModal(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim() || isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? "กำลังสร้าง..." : "สร้างโปรเจกต์"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}