"use client"

import { useState } from "react"

export default function LeadForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    interest: "",
  })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus("success")
        setMessage(data.message)
        setFormData({ name: "", email: "", phone: "", company: "", interest: "" })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      setStatus("error")
      setMessage(error.message || "เกิดข้อผิดพลาด")
    }
  }

  return (
    <section id="lead" className="py-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">สนใจบริการของเรา?</h2>
            <p className="mb-12 text-muted-foreground">กรุณากรอกข้อมูลด้านล่างเพื่อให้เราติดต่อกลับ</p>
    
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4 p-6 bg-white rounded-xl shadow-lg">

        <div className="grid grid-cols-2 gap-4">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
            <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ชื่อ-นามสกุล"
            />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label>
            <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="email@company.com"
            />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
            <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="08x-xxx-xxxx"
            />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บริษัท</label>
            <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ชื่อบริษัท"
            />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สนใจบริการ</label>
            <select
            value={formData.interest}
            onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
            <option value="">เลือกบริการที่สนใจ</option>
            <option value="ai-chatbot">AI Chatbot สำหรับองค์กร</option>
            <option value="web-development">พัฒนาเว็บไซต์</option>
            <option value="consulting">ที่ปรึกษา IT</option>
            <option value="training">อบรมบุคลากร</option>
            </select>
        </div>

        {status === "success" && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">{message}</div>
        )}
        {status === "error" && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">{message}</div>
        )}

        <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
        >
            {status === "loading" ? "กำลังส่ง..." : "ส่งข้อมูล"}
        </button>
        </form>
        </div>

    </section>
  )
}