"use client"

import { useState, useRef } from "react"

interface FileUploadProps {
  onUploadSuccess: () => void
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ACCEPTED_TYPES = ".pdf,.csv,.txt"
  const MAX_SIZE_MB = 10

  async function handleFiles(files: FileList) {
    if (files.length === 0) return

    setIsUploading(true)
    setUploadStatus(null)

    let successCount = 0
    let errorCount = 0

    for (const file of Array.from(files)) {
      // ตรวจสอบขนาด
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setUploadStatus(`❌ ${file.name} เกินขนาด ${MAX_SIZE_MB}MB`)
        errorCount++
        continue
      }

      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/knowledge/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()

        if (res.ok) {
          successCount++
        } else {
          setUploadStatus(`❌ ${file.name}: ${data.error}`)
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    if (successCount > 0) {
      setUploadStatus(`✅ อัปโหลดสำเร็จ ${successCount} ไฟล์`)
      onUploadSuccess()
    }

    setIsUploading(false)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />

      <div className="text-4xl mb-3">📁</div>
      <p className="text-gray-700 font-medium mb-1">
        {isUploading ? "⏳ กำลังอัปโหลด..." : "ลากไฟล์มาวางที่นี่"}
      </p>
      <p className="text-sm text-gray-500 mb-4">
        รองรับ PDF, CSV, TXT (สูงสุด {MAX_SIZE_MB}MB)
      </p>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        เลือกไฟล์
      </button>

      {uploadStatus && (
        <p className="mt-3 text-sm">{uploadStatus}</p>
      )}
    </div>
  )
}