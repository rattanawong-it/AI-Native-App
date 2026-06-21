"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Plus,
  Search,
  MoreHorizontal,
  Users,
  Mail,
  Shield,
  Crown,
  UserCheck,
  UserPlus,
  X,
  Loader2,
  Briefcase,
  Globe,
  MessageSquare,
} from "lucide-react"

// ประเภทข้อมูล
type MemberRole = "owner" | "admin" | "member" | "viewer"
type TeamStatus = "active" | "inactive"

interface Member {
  id: string
  name: string
  email: string
  role: MemberRole
  avatar: string
  joinedAt: string
  lastActive: string
  projects: number
}

interface Team {
  id: string
  name: string
  description: string
  status: TeamStatus
  members: Member[]
  projects: number
  createdAt: string
}

// ข้อมูลตัวอย่าง
const SAMPLE_TEAMS: Team[] = [
  {
    id: "1",
    name: "Development Team",
    description: "ทีมพัฒนาระบบ ",
    status: "active",
    projects: 4,
    createdAt: "2025-06-15",
    members: [
      { id: "m1", name: "Rattana Wongboonnak", email: "Rattana.Wongboonnak@krirk.ac.th", role: "admin", avatar: "RW", joinedAt: "2025-06-15", lastActive: "2026-03-02", projects: 1 },
    ],
  },
  {
    id: "2",
    name: "Website Team",
    description: "ทีมพัฒนาเว็บไซต์และ Frontend ",
    status: "active",
    projects: 3,
    createdAt: "2025-08-01",
    members: [
      { id: "m5", name: "Kanya Chaiyo", email: "kanya@example.com", role: "owner", avatar: "KC", joinedAt: "2025-08-01", lastActive: "2026-03-02", projects: 3 },
      { id: "m6", name: "Tanit Meesuk", email: "tanit@example.com", role: "admin", avatar: "TM", joinedAt: "2025-08-15", lastActive: "2026-03-01", projects: 2 },
      { id: "m7", name: "Wanida Porn", email: "wanida@example.com", role: "member", avatar: "WP", joinedAt: "2025-09-01", lastActive: "2026-03-02", projects: 2 },
    ],
  },
  {
    id: "3",
    name: "Data Engineering",
    description: "ทีมจัดการข้อมูล, Pipeline และ Vector Database สำหรับ AI",
    status: "active",
    projects: 2,
    createdAt: "2025-10-01",
    members: [
      { id: "m8", name: "Preecha Data", email: "preecha@example.com", role: "owner", avatar: "PD", joinedAt: "2025-10-01", lastActive: "2026-03-02", projects: 2 },
      { id: "m9", name: "Suda Vector", email: "suda@example.com", role: "member", avatar: "SV", joinedAt: "2025-10-15", lastActive: "2026-02-27", projects: 1 },
    ],
  },
  {
    id: "4",
    name: "QA & Testing",
    description: "ทีมทดสอบคุณภาพซอฟต์แวร์และ AI Model Evaluation",
    status: "inactive",
    projects: 1,
    createdAt: "2025-11-01",
    members: [
      { id: "m10", name: "Chai Test", email: "chai@example.com", role: "owner", avatar: "CT", joinedAt: "2025-11-01", lastActive: "2026-01-15", projects: 1 },
      { id: "m11", name: "Nida QA", email: "nida@example.com", role: "member", avatar: "NQ", joinedAt: "2025-11-10", lastActive: "2026-01-20", projects: 1 },
      { id: "m12", name: "Somchai Bug", email: "somchai@example.com", role: "viewer", avatar: "SB", joinedAt: "2025-12-01", lastActive: "2026-01-10", projects: 0 },
    ],
  },
]

// สีตาม Role
const roleConfig: Record<MemberRole, { label: string; color: string; bgColor: string; icon: typeof Shield }> = {
  owner: {
    label: "Owner",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: Crown,
  },
  admin: {
    label: "Admin",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: Shield,
  },
  member: {
    label: "Member",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: UserCheck,
  },
  viewer: {
    label: "Viewer",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-700",
    icon: Globe,
  },
}

const avatarColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-500",
  "bg-indigo-500",
]

function getAvatarColor(id: string) {
  const idx = id.charCodeAt(1) % avatarColors.length
  return avatarColors[idx]
}

export default function TeamContent() {
  const [teams] = useState<Team[]>(SAMPLE_TEAMS)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<MemberRole>("member")
  const [isSending, setIsSending] = useState(false)

  // กรองทีม
  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // สถิติรวม
  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0)
  const totalProjects = teams.reduce((sum, t) => sum + t.projects, 0)
  const activeTeams = teams.filter((t) => t.status === "active").length

  const stats = [
    { label: "ทีมทั้งหมด", value: teams.length, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "ทีมที่ Active", value: activeTeams, icon: UserCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "สมาชิกรวม", value: totalMembers, icon: UserPlus, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
    { label: "โปรเจกต์รวม", value: totalProjects, icon: Briefcase, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
  ]

  function handleInvite() {
    if (!inviteEmail.trim()) return
    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      setShowInviteModal(false)
      setInviteEmail("")
      setInviteRole("member")
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Teams</h2>
          <p className="text-muted-foreground mt-1">จัดการทีมและสมาชิกในองค์กรของคุณ</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          เชิญสมาชิก
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ค้นหาทีม..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Teams List */}
      <div className="grid gap-5 lg:grid-cols-2">
        {filteredTeams.map((team) => (
          <Card
            key={team.id}
            className={`group transition-shadow hover:shadow-lg cursor-pointer ${
              selectedTeam?.id === team.id ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{team.name}</CardTitle>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        team.status === "active"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {team.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{team.description}</p>
                </div>
                <button className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="pb-3">
              {/* Members Avatars */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {team.members.slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className={`w-8 h-8 rounded-full ${getAvatarColor(member.id)} flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white dark:ring-gray-800`}
                      title={member.name}
                    >
                      {member.avatar}
                    </div>
                  ))}
                  {team.members.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-semibold ring-2 ring-white dark:ring-gray-800">
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{team.members.length} สมาชิก</span>
              </div>
            </CardContent>

            <CardFooter className="border-t dark:border-gray-700 pt-3 pb-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{team.projects} โปรเจกต์</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>สร้างเมื่อ {new Date(team.createdAt).toLocaleDateString("th-TH", { month: "short", year: "numeric" })}</span>
                </div>
              </div>
            </CardFooter>

            {/* Expanded Member List */}
            {selectedTeam?.id === team.id && (
              <div className="border-t dark:border-gray-700 px-6 py-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">สมาชิกทั้งหมด</h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowInviteModal(true)
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="h-3 w-3" />
                    เชิญเพิ่ม
                  </button>
                </div>
                {team.members.map((member) => {
                  const role = roleConfig[member.role]
                  const RoleIcon = role.icon
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={`w-9 h-9 rounded-full ${getAvatarColor(member.id)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}
                      >
                        {member.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {member.projects} โปรเจกต์
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${role.bgColor} ${role.color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {role.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ไม่พบทีม</h3>
          <p className="text-muted-foreground mt-1">ลองค้นหาด้วยคำอื่น</p>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowInviteModal(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                เชิญสมาชิกใหม่
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  อีเมล
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["admin", "member", "viewer"] as MemberRole[]).map((role) => {
                    const config = roleConfig[role]
                    const Icon = config.icon
                    return (
                      <button
                        key={role}
                        onClick={() => setInviteRole(role)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition ${
                          inviteRole === role
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                            : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                disabled={isSending}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isSending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
              >
                {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSending ? "กำลังส่ง..." : "ส่งคำเชิญ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}