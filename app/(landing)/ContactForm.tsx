"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface FormData {
  name: string
  phone: string
  service: string
  message: string
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    service: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      // 1. ส่งข้อมูลไปยัง API (ซึ่งจะยิงไป n8n)
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to submit form")
      }

      // 2. แสดงข้อความสำเร็จ
      setIsSuccess(true)
      setFormData({ name: "", phone: "", service: "", message: "" })
    } catch (err) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
      console.error("Form submission error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl max-w-lg mx-auto my-12 bg-green-50 dark:bg-green-900/20 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
          <svg
            className="h-8 w-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-xl font-semibold text-green-800 dark:text-green-200">
          ส่งข้อมูลสำเร็จ!
        </h3>
        <p className="text-green-700 dark:text-green-300">
          ขอบคุณที่สนใจ ทีมงานจะติดต่อกลับโดยเร็ว
        </p>
        <Button
          onClick={() => setIsSuccess(false)}
          variant="outline"
          className="mt-4"
        >
          ส่งข้อมูลอีกครั้ง
        </Button>
      </div>
    )
  }

  return (
    <>
        <h1 className="mb-6 text-center text-3xl font-bold text-slate-800 dark:text-slate-200">
            ติดต่อเรา (ส่งเข้า n8n ผ่าน API Route)
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto my-12">
        {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
            {error}
            </div>
        )}

        <div>
            <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
            ชื่อ-นามสกุล *
            </label>
            <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            placeholder="กรอกชื่อของคุณ"
            />
        </div>

        <div>
            <label
            htmlFor="phone"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
            เบอร์โทรศัพท์ *
            </label>
            <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            pattern="[0-9]{10}"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            placeholder="08x-xxx-xxxx"
            />
        </div>

        <div>
            <label
            htmlFor="service"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
            บริการที่สนใจ *
            </label>
            <select
            id="service"
            name="service"
            value={formData.service}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
            <option value="">เลือกบริการ</option>
            <option value="ai-chatbot">AI Chatbot สำหรับธุรกิจ</option>
            <option value="ai-automation">AI Automation</option>
            <option value="ai-consulting">AI Consulting</option>
            <option value="ai-training">AI Training Course</option>
            </select>
        </div>

        <div>
            <label
            htmlFor="message"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
            ข้อความเพิ่มเติม
            </label>
            <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            placeholder="บอกเราเพิ่มเติมเกี่ยวกับความต้องการของคุณ"
            />
        </div>

        <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
        >
            {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
                </svg>
                กำลังส่ง...
            </span>
            ) : (
            "ส่งข้อมูล"
            )}
        </Button>
        </form>
    </>
  )
}