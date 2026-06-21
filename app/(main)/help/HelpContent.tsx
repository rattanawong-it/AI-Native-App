"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Search,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Database,
  Bot,
  Shield,
  Users,
  Settings,
  BookOpen,
  Lightbulb,
  ExternalLink,
  HelpCircle,
  Mail,
  Zap,
  FileText,
  FolderOpen,
  BarChart3,
  Keyboard,
} from "lucide-react"

// ===================== Types =====================

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  id: string
  title: string
  icon: typeof HelpCircle
  color: string
  bgColor: string
  items: FAQItem[]
}

interface GuideItem {
  title: string
  description: string
  icon: typeof BookOpen
  color: string
  bgColor: string
  steps: string[]
}

interface ShortcutItem {
  keys: string[]
  action: string
}

// ===================== Data =====================

const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: "chat",
    title: "AI Chat",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    items: [
      { question: "AI Chat ทำงานอย่างไร?", answer: "ระบบใช้ RAG (Retrieval-Augmented Generation) โดยจะค้นหาข้อมูลจาก Knowledge Base ที่เกี่ยวข้องก่อน แล้วส่งให้ OpenAI สร้างคำตอบที่ถูกต้องและตรงประเด็น" },
      { question: "สามารถสร้างหลาย Session ได้ไหม?", answer: "ได้ครับ คุณสามารถสร้าง Session ใหม่ได้ไม่จำกัด แต่ละ Session จะเก็บบทสนทนาแยกกัน และสามารถเปลี่ยนชื่อหรือลบได้ตลอดเวลา" },
      { question: "Chat รองรับรูปแบบคำตอบอะไรบ้าง?", answer: "รองรับ Markdown เต็มรูปแบบ รวมถึงตาราง, โค้ดบล็อก, รายการ, หัวข้อ, ลิงก์ และ Blockquote โดยจะแสดงผลสวยงามอัตโนมัติ" },
      { question: "ทำไมบางครั้ง AI ตอบว่าไม่พบข้อมูล?", answer: "เกิดขึ้นเมื่อคำถามไม่ตรงกับข้อมูลใน Knowledge Base ลองเพิ่มเอกสารที่เกี่ยวข้อง หรือปรับ Top K ใน Settings เพื่อขยายขอบเขตการค้นหา" },
    ],
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    icon: Database,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    items: [
      { question: "รองรับไฟล์ประเภทอะไรบ้าง?", answer: "รองรับ .txt, .csv และ .pdf สามารถอัปโหลดไฟล์ได้สูงสุด 10MB ต่อไฟล์" },
      { question: "Index to Vector DB คืออะไร?", answer: "คือการนำเอกสารมาแบ่งเป็นชิ้นเล็กๆ (Chunks) แปลงเป็น Embedding ด้วย OpenAI แล้วเก็บลง pgVector Database เพื่อให้ AI สามารถค้นหาข้อมูลที่เกี่ยวข้องได้อย่างรวดเร็ว" },
      { question: "สามารถแก้ไขเอกสารที่อัปโหลดแล้วได้ไหม?", answer: "ได้ครับ สามารถแก้ไขชื่อ, คำอธิบาย และเนื้อหาได้ หลังแก้ไขให้กด Index ใหม่เพื่ออัปเดต Vector Database" },
      { question: "ลบเอกสารแล้ว Vector Chunks จะหายไหม?", answer: "หายครับ ระบบจะลบ Chunks ทั้งหมดที่เกี่ยวข้องโดยอัตโนมัติ (Cascade Delete)" },
    ],
  },
  {
    id: "auth",
    title: "บัญชีและความปลอดภัย",
    icon: Shield,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    items: [
      { question: "รองรับการเข้าสู่ระบบผ่านช่องทางใดบ้าง?", answer: "รองรับ Email/Password, Google, GitHub, LINE และ Facebook โดยถ้าอีเมลตรงกัน ระบบจะเชื่อมบัญชีอัตโนมัติ (Account Linking)" },
      { question: "เปิดใช้ 2FA ได้อย่างไร?", answer: "ไปที่ Profile > Security แล้วเปิด Two-Factor Authentication ระบบจะสร้าง QR Code ให้สแกนด้วยแอป Authenticator (เช่น Google Authenticator)" },
      { question: "ลืมรหัสผ่านทำอย่างไร?", answer: "คลิก 'ลืมรหัสผ่าน' ที่หน้า Login ระบบจะส่งอีเมลลิงก์รีเซ็ตไปให้ (ใช้งานได้ 1 ชั่วโมง)" },
    ],
  },
  {
    id: "admin",
    title: "การจัดการระบบ",
    icon: Settings,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    items: [
      { question: "Role ในระบบมีอะไรบ้าง?", answer: "มี 3 ระดับ: Admin (จัดการทุกอย่าง), Manager (สร้าง/แก้ไขโปรเจกต์), User (สร้าง/อ่านโปรเจกต์)" },
      { question: "Admin สามารถจัดการ User ได้อย่างไร?", answer: "ไปที่เมนู Admin > Users จะเห็นรายชื่อผู้ใช้ทั้งหมด สามารถเปลี่ยน Role, Ban/Unban หรือ Impersonate ได้" },
      { question: "เปลี่ยน AI Model ได้ที่ไหน?", answer: "ไปที่ Admin > Settings > แท็บ 'AI & โมเดล' สามารถเปลี่ยน Chat Model, Embedding Model, Temperature และ Max Tokens ได้" },
    ],
  },
]

const GUIDES: GuideItem[] = [
  {
    title: "เริ่มต้นใช้งาน AI Chat",
    description: "เรียนรู้วิธีสนทนากับ AI ที่เชื่อมต่อ Knowledge Base",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    steps: [
      "เปิดเมนู AI & Data > Chat",
      "คลิก 'สร้างแชทใหม่' เพื่อเริ่ม Session",
      "พิมพ์คำถามที่ต้องการถาม แล้วกด Enter หรือคลิกปุ่มส่ง",
      "AI จะค้นหาข้อมูลจาก Knowledge Base และตอบคำถามแบบ Streaming",
      "สามารถเปลี่ยนชื่อ Session หรือลบได้จากแถบด้านซ้าย",
    ],
  },
  {
    title: "เพิ่มข้อมูลใน Knowledge Base",
    description: "อัปโหลดเอกสารและ Index เพื่อให้ AI ใช้ตอบคำถาม",
    icon: FolderOpen,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    steps: [
      "ไปที่เมนู Admin > Knowledge",
      "คลิก '+ สร้างเอกสารใหม่'",
      "กรอกชื่อ, คำอธิบาย และอัปโหลดไฟล์ (.txt, .csv, .pdf) หรือพิมพ์เนื้อหาเอง",
      "คลิก 'บันทึก' เพื่อสร้างเอกสาร",
      "คลิกปุ่ม 'Index to Vector DB' เพื่อแปลงเป็น Embedding และเก็บลงฐานข้อมูล",
      "กลับไปหน้า Chat แล้วลองถามคำถามที่เกี่ยวข้อง!",
    ],
  },
  {
    title: "จัดการทีมและโปรเจกต์",
    description: "สร้างทีม, เชิญสมาชิก และจัดการโปรเจกต์",
    icon: Users,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    steps: [
      "ไปที่เมนู Management > Teams",
      "ดูรายการทีมและคลิกเพื่อดูสมาชิก",
      "คลิก 'เชิญสมาชิก' เพื่อเพิ่มคนใหม่เข้าทีม",
      "ไปที่ Management > Projects เพื่อสร้างและติดตามโปรเจกต์",
    ],
  },
]

const SHORTCUTS: ShortcutItem[] = [
  { keys: ["Enter"], action: "ส่งข้อความ Chat" },
  { keys: ["Shift", "Enter"], action: "ขึ้นบรรทัดใหม่ใน Chat" },
  { keys: ["Ctrl", "K"], action: "ค้นหาด่วน" },
  { keys: ["Ctrl", "B"], action: "เปิด/ปิด Sidebar" },
]

const TECH_STACK = [
  { name: "Next.js 16", desc: "App Router + React 19", icon: Zap },
  { name: "OpenAI", desc: "GPT-4o + Embeddings", icon: Bot },
  { name: "Prisma 7", desc: "PostgreSQL (Neon)", icon: Database },
  { name: "pgVector", desc: "Vector Search", icon: BarChart3 },
  { name: "better-auth", desc: "Auth + RBAC + 2FA", icon: Shield },
  { name: "Tailwind CSS", desc: "Styling + Dark Mode", icon: FileText },
]

// ===================== Component =====================

export default function HelpContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<"faq" | "guides" | "shortcuts" | "tech">("faq")

  // กรอง FAQ ตามคำค้นหา
  const filteredCategories = FAQ_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0)

  const totalFAQ = FAQ_CATEGORIES.reduce((s, c) => s + c.items.length, 0)

  function toggleFAQ(key: string) {
    setExpandedFAQ(expandedFAQ === key ? null : key)
  }

  const sections = [
    { id: "faq" as const, label: "คำถามที่พบบ่อย", icon: HelpCircle, count: totalFAQ },
    { id: "guides" as const, label: "คู่มือการใช้งาน", icon: BookOpen, count: GUIDES.length },
    { id: "shortcuts" as const, label: "ปุ่มลัด", icon: Keyboard, count: SHORTCUTS.length },
    { id: "tech" as const, label: "เทคโนโลยีที่ใช้", icon: Lightbulb, count: TECH_STACK.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
          <HelpCircle className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">ศูนย์ช่วยเหลือ</h2>
        <p className="text-muted-foreground mt-1">ค้นหาคำตอบ คู่มือการใช้งาน และข้อมูลเทคนิค</p>

        {/* Search */}
        <div className="relative mt-5 max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="ค้นหาคำถามหรือหัวข้อ..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (e.target.value) setActiveSection("faq")
            }}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm"
          />
        </div>
      </div>

      {/* Section Tabs */}
      {!searchQuery && (
        <div className="flex flex-wrap justify-center gap-2">
          {sections.map((sec) => {
            const Icon = sec.icon
            const isActive = activeSection === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {sec.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {sec.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ==================== FAQ ==================== */}
      {(activeSection === "faq" || searchQuery) && (
        <div className="space-y-5">
          {(searchQuery ? filteredCategories : FAQ_CATEGORIES).map((category) => {
            const Icon = category.icon
            return (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${category.bgColor}`}>
                      <Icon className={`h-4 w-4 ${category.color}`} />
                    </div>
                    {category.title}
                    <span className="text-xs font-normal text-muted-foreground">({category.items.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  {category.items.map((item, idx) => {
                    const key = `${category.id}-${idx}`
                    const isOpen = expandedFAQ === key
                    return (
                      <div key={key} className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleFAQ(key)}
                          className="w-full flex items-center justify-between p-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white pr-4">{item.question}</span>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-3.5 pb-3.5 pt-0">
                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                              {item.answer}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}

          {searchQuery && filteredCategories.length === 0 && (
            <div className="text-center py-16">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ไม่พบผลลัพธ์</h3>
              <p className="text-muted-foreground mt-1">ลองค้นหาด้วยคำอื่น หรือติดต่อทีมสนับสนุน</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== Guides ==================== */}
      {activeSection === "guides" && !searchQuery && (
        <div className="grid gap-5 lg:grid-cols-3">
          {GUIDES.map((guide) => {
            const Icon = guide.icon
            return (
              <Card key={guide.title} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className={`w-10 h-10 rounded-xl ${guide.bgColor} flex items-center justify-center mb-2`}>
                    <Icon className={`h-5 w-5 ${guide.color}`} />
                  </div>
                  <CardTitle className="text-base">{guide.title}</CardTitle>
                  <CardDescription>{guide.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ol className="space-y-2.5">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ==================== Shortcuts ==================== */}
      {activeSection === "shortcuts" && !searchQuery && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ปุ่มลัดที่ใช้บ่อย
            </CardTitle>
            <CardDescription>ทางลัดสำหรับเร่งการทำงาน</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SHORTCUTS.map((sc) => (
                <div
                  key={sc.action}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{sc.action}</span>
                  <div className="flex items-center gap-1">
                    {sc.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm">
                          {k}
                        </kbd>
                        {i < sc.keys.length - 1 && <span className="text-xs text-muted-foreground mx-1">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== Tech Stack ==================== */}
      {activeSection === "tech" && !searchQuery && (
        <div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_STACK.map((tech) => {
              const Icon = tech.icon
              return (
                <Card key={tech.name}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Contact Footer */}
      <Card className="border-dashed">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20">
              <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">ยังหาคำตอบไม่เจอ?</p>
              <p className="text-xs text-muted-foreground">ติดต่อทีมสนับสนุนเพื่อขอความช่วยเหลือเพิ่มเติม</p>
            </div>
          </div>
          <a
            href="mailto:support@ainative.app"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition shadow-sm"
          >
            <Mail className="h-4 w-4" />
            ส่งอีเมลหาเรา
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}