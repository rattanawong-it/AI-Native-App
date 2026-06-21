"use client"

import { useEffect, useState } from "react"
import {
  Search,
  Users,
  UserPlus,
  UserCheck,
  Star,
  ArrowUpRight,
  Mail,
  Phone,
  Building2,
  Sparkles,
  Clock,
  ChevronDown,
  RefreshCw,
  Eye,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// ===== Types =====
interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  interest: string | null
  source: string
  status: string
  createdAt: string
  updatedAt: string
}

// ===== Status Config =====
const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; dotColor: string }
> = {
  new: {
    label: "ใหม่",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    dotColor: "bg-blue-500",
  },
  contacted: {
    label: "ติดต่อแล้ว",
    color: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-50 dark:bg-yellow-900/30",
    dotColor: "bg-yellow-500",
  },
  qualified: {
    label: "มีศักยภาพ",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    dotColor: "bg-emerald-500",
  },
  converted: {
    label: "เป็นลูกค้าแล้ว",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-900/30",
    dotColor: "bg-purple-500",
  },
}

// ===== Interest Labels =====
const interestLabels: Record<string, string> = {
  "ai-chatbot": "AI Chatbot สำหรับองค์กร",
  "web-development": "พัฒนาเว็บไซต์",
  consulting: "ที่ปรึกษา IT",
  training: "อบรมบุคลากร",
}

// ===== Component =====
export default function LeadContent() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  // Fetch leads
  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/leads")
      if (res.ok) {
        const data = await res.json()
        setLeads(data)
      }
    } catch (error) {
      console.error("Failed to fetch leads:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  // Update lead status
  const updateStatus = async (leadId: string, newStatus: string) => {
    setUpdatingStatus(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
        )
        if (selectedLead?.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus })
        }
      }
    } catch (error) {
      console.error("Failed to update status:", error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  // Filter & search
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.phone || "").includes(searchQuery)

    const matchesStatus =
      filterStatus === "all" || lead.status === filterStatus

    return matchesSearch && matchesStatus
  })

  // Stats
  const stats = [
    {
      label: "Lead ทั้งหมด",
      value: leads.length,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      label: "Lead ใหม่",
      value: leads.filter((l) => l.status === "new").length,
      icon: UserPlus,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
    },
    {
      label: "ติดต่อแล้ว",
      value: leads.filter((l) => l.status === "contacted").length,
      icon: UserCheck,
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-900/30",
    },
    {
      label: "เป็นลูกค้าแล้ว",
      value: leads.filter((l) => l.status === "converted").length,
      icon: Star,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/30",
    },
  ]

  // Format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Time ago
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} นาทีที่แล้ว`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
    const days = Math.floor(hours / 24)
    return `${days} วันที่แล้ว`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Leads
          </h2>
          <p className="text-muted-foreground mt-1">
            จัดการ Lead ที่เข้ามาจากเว็บไซต์และช่องทางต่าง ๆ
          </p>
        </div>
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรช
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
            placeholder="ค้นหา Lead... (ชื่อ, อีเมล, บริษัท, เบอร์โทร)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "new", "contacted", "qualified", "converted"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  filterStatus === status
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {status === "all" ? "ทั้งหมด" : statusConfig[status].label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-3 animate-spin" />
          <p className="text-muted-foreground">กำลังโหลดข้อมูล Lead...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            ไม่พบ Lead
          </h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery || filterStatus !== "all"
              ? "ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง"
              : "ยังไม่มี Lead เข้ามา — Lead จะปรากฏที่นี่เมื่อมีคนกรอกฟอร์มจากเว็บไซต์"}
          </p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    ชื่อ / อีเมล
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    บริษัท
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    สนใจ
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    สถานะ
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                    เวลา
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredLeads.map((lead) => {
                  const status = statusConfig[lead.status] || statusConfig.new
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                              {lead.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {lead.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {lead.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-gray-700 dark:text-gray-300">
                          {lead.company || "-"}
                        </span>
                      </td>

                      {/* Interest */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-gray-700 dark:text-gray-300">
                          {lead.interest
                            ? interestLabels[lead.interest] || lead.interest
                            : "-"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <div className="relative inline-block">
                          <select
                            value={lead.status}
                            disabled={updatingStatus === lead.id}
                            onChange={(e) =>
                              updateStatus(lead.id, e.target.value)
                            }
                            className={`appearance-none pl-5 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${status.bg} ${status.color}`}
                          >
                            <option value="new">ใหม่</option>
                            <option value="contacted">ติดต่อแล้ว</option>
                            <option value="qualified">มีศักยภาพ</option>
                            <option value="converted">เป็นลูกค้าแล้ว</option>
                          </select>
                          <span
                            className={`absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${status.dotColor}`}
                          />
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-50" />
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(lead.createdAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          ดู
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Count footer */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground">
            แสดง {filteredLeads.length} จาก {leads.length} Lead
          </div>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedLead(null)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {selectedLead.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {selectedLead.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedLead.source}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  สถานะ
                </label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => updateStatus(selectedLead.id, key)}
                      disabled={updatingStatus === selectedLead.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                        selectedLead.status === key
                          ? `${config.bg} ${config.color} border-current`
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          selectedLead.status === key
                            ? config.dotColor
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      />
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">อีเมล</p>
                    <a
                      href={`mailto:${selectedLead.email}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    >
                      {selectedLead.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">เบอร์โทร</p>
                    {selectedLead.phone ? (
                      <a
                        href={`tel:${selectedLead.phone}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {selectedLead.phone}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-500">-</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">บริษัท</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedLead.company || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">สนใจบริการ</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedLead.interest
                        ? interestLabels[selectedLead.interest] ||
                          selectedLead.interest
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">เข้ามาเมื่อ</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedLead.createdAt)} ({timeAgo(selectedLead.createdAt)})
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
              <a
                href={`mailto:${selectedLead.email}`}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                <Mail className="h-4 w-4" />
                ส่งอีเมล
              </a>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}