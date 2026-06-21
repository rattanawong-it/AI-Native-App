"use client"

import { useEffect, useState } from "react"
import {
  Users,
  MessageCircle,
  RefreshCw,
  Power,
  PowerOff,
  Plus,
  X,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface LineGroup {
  id: string
  groupId: string
  groupName: string | null
  active: boolean
  joinedAt: string
  updatedAt: string
}

export default function LineGroupsContent() {
  const [groups, setGroups] = useState<LineGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGroupId, setNewGroupId] = useState("")
  const [newGroupName, setNewGroupName] = useState("")
  const [adding, setAdding] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Fetch groups
  const fetchGroups = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/line/groups")
      if (res.ok) setGroups(await res.json())
    } catch (error) {
      console.error("Failed to fetch groups:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  // Toggle active
  const toggleActive = async (group: LineGroup) => {
    setToggling(group.id)
    try {
      const res = await fetch(`/api/line/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !group.active }),
      })
      if (res.ok) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === group.id ? { ...g, active: !g.active } : g
          )
        )
      }
    } catch (error) {
      console.error("Failed to toggle:", error)
    } finally {
      setToggling(null)
    }
  }

  // Add group manually
  const addGroup = async () => {
    if (!newGroupId.trim()) return
    setAdding(true)
    try {
      const res = await fetch("/api/line/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: newGroupId.trim(),
          groupName: newGroupName.trim() || null,
        }),
      })
      if (res.ok) {
        setShowAddModal(false)
        setNewGroupId("")
        setNewGroupName("")
        fetchGroups()
      }
    } catch (error) {
      console.error("Failed to add:", error)
    } finally {
      setAdding(false)
    }
  }

  // Stats
  const activeCount = groups.filter((g) => g.active).length
  const inactiveCount = groups.filter((g) => !g.active).length

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            LINE Groups
          </h2>
          <p className="text-muted-foreground mt-1">
            จัดการกลุ่ม LINE ที่ Bot เข้าร่วม — เปิด/ปิดการแจ้งเตือน Lead ใหม่
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่มกลุ่ม
          </button>
          <button
            onClick={fetchGroups}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">กลุ่มทั้งหมด</p>
                <p className="text-2xl font-bold mt-1">{groups.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เปิดแจ้งเตือน</p>
                <p className="text-2xl font-bold mt-1">{activeCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ปิดแจ้งเตือน</p>
                <p className="text-2xl font-bold mt-1">{inactiveCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <XCircle className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-3 animate-spin" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            ยังไม่มีกลุ่ม LINE
          </h3>
          <p className="text-muted-foreground mt-1">
            เชิญ Bot เข้ากลุ่ม LINE แล้วระบบจะบันทึกอัตโนมัติ
            <br />
            หรือกดปุ่ม &quot;เพิ่มกลุ่ม&quot; เพื่อเพิ่ม Group ID ด้วยมือ
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className={`transition ${
                group.active
                  ? "border-emerald-200 dark:border-emerald-800"
                  : "border-gray-200 dark:border-gray-700 opacity-60"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  {/* Icon + Name */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                        group.active
                          ? "bg-emerald-100 dark:bg-emerald-900/40"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      <MessageCircle
                        className={`h-5 w-5 ${
                          group.active
                            ? "text-emerald-600"
                            : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {group.groupName || "ไม่ทราบชื่อกลุ่ม"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {group.groupId}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      group.active
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        group.active ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    />
                    {group.active ? "เปิด" : "ปิด"}
                  </span>
                </div>

                {/* Time */}
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  เข้าร่วมเมื่อ {formatDate(group.joinedAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => toggleActive(group)}
                    disabled={toggling === group.id}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                      group.active
                        ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                    }`}
                  >
                    {group.active ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5" />
                        ปิดแจ้งเตือน
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5" />
                        เปิดแจ้งเตือน
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
          💡 วิธีเพิ่มกลุ่มอัตโนมัติ
        </h4>
        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>เชิญ Bot เข้ากลุ่ม LINE ที่ต้องการ</li>
          <li>Bot จะบันทึก Group ID ลงฐานข้อมูลอัตโนมัติ</li>
          <li>กลุ่มจะปรากฏที่หน้านี้ พร้อมเปิดใช้งานทันที</li>
          <li>เมื่อมี Lead ใหม่ ระบบจะส่งแจ้งเตือนไปทุกกลุ่มที่เปิดอยู่</li>
        </ol>
      </div>

      {/* Add Group Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                เพิ่มกลุ่ม LINE
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group ID *
                </label>
                <input
                  type="text"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  placeholder="Cf224170d8039209f126bf7ffc0cd6e81"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ดู Group ID ได้จาก Terminal log เมื่อ Bot รับข้อความจากกลุ่ม
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อกลุ่ม (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="ทีมขาย AI Native"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={addGroup}
                disabled={!newGroupId.trim() || adding}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
              >
                {adding ? "กำลังเพิ่ม..." : "เพิ่มกลุ่ม"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}