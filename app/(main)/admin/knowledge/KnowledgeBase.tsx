"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { X, Loader2, CheckCircle } from "lucide-react"
import FileUpload from "@/components/knowledge/FileUpload"

interface KnowledgeDocument {
  id: string
  title: string
  content: string
  source: string | null
  fileType: string | null
  fileSize: number | null
  isIndexed: boolean
  createdAt: string
  updatedAt: string
}

export default function KnowledgeBase() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<"view" | "new" | "edit">("view")
  const [formData, setFormData] = useState({ title: "", content: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Redirect ถ้าไม่ได้ล็อกอิน
  useEffect(() => {
    if (!isPending && !session) router.push("/auth/signin")
  }, [session, isPending, router])

  // โหลดเอกสาร
  useEffect(() => {
    loadDocuments()
  }, [searchQuery])

  async function loadDocuments() {
    setIsLoading(true)
    try {
      const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""
      const res = await fetch(`/api/knowledge${params}`)
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error("Failed to load documents:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // สร้าง/แก้ไขเอกสาร
  async function handleSave() {
    if (!formData.title || !formData.content) return
    setIsSaving(true)

    try {
      const url = mode === "edit" ? `/api/knowledge/${selectedDoc?.id}` : "/api/knowledge"
      const method = mode === "edit" ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        setMode("view")
        setSelectedDoc(data.document)
        await loadDocuments()
      }
    } catch (error) {
      console.error("Save failed:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // ลบเอกสาร
  async function handleDelete(id: string) {
    setIsDeleting(true)
    try {
      await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
      setSelectedDoc(null)
      setShowDeleteModal(false)
      await loadDocuments()
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Index เข้า Vector DB
  async function handleIndex(id: string) {
    setIsIndexing(true)
    try {
      const res = await fetch(`/api/knowledge/${id}/index`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSuccessMessage(data.message)
        setShowSuccessModal(true)
        await loadDocuments()
        if (selectedDoc?.id === id) {
          setSelectedDoc({ ...selectedDoc, isIndexed: true })
        }
      }
    } catch (error) {
      console.error("Index failed:", error)
    } finally {
      setIsIndexing(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <div className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📚 Knowledge Base
            </h1>
            <button
              onClick={() => {
                setMode("new")
                setFormData({ title: "", content: "" })
                setSelectedDoc(null)
              }}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
            >
              + Add
            </button>
          </div>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                setSelectedDoc(doc)
                setMode("view")
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-gray-800 transition ${
                selectedDoc?.id === doc.id ? "bg-blue-50 dark:bg-gray-800 border-l-4 border-l-blue-600" : ""
              }`}
            >
              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{doc.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{doc.content}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  Updated {new Date(doc.updatedAt).toLocaleDateString("th-TH")}
                </span>
                {doc.isIndexed && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">✓ Indexed</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          ✨ {documents.length} documents for AI
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {mode === "view" && selectedDoc ? (
          /* Document Detail View */
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedDoc.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date(selectedDoc.updatedAt).toLocaleString("th-TH")}
                  {selectedDoc.source && ` • Source: ${selectedDoc.source}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!selectedDoc.isIndexed && (
                  <button
                    onClick={() => handleIndex(selectedDoc.id)}
                    disabled={isIndexing}
                    className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isIndexing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลัง Index...
                      </>
                    ) : (
                      "🧠 Index to AI"
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1"
                >
                  🗑 Delete
                </button>
                <button
                  onClick={() => {
                    setMode("edit")
                    setFormData({ title: selectedDoc.title, content: selectedDoc.content })
                  }}
                  className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {selectedDoc.content}
                </p>
              </div>
            </div>
          </>
        ) : mode === "new" || mode === "edit" ? (
          /* New/Edit Document Form */
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {mode === "new" ? "New Document" : "Edit Document"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode("view")}
                  className="text-sm px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300"
                >
                  ✕ Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.title || !formData.content}
                  className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "💾 Save"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-4">
                {/* File Upload (เฉพาะ mode new) */}
                {mode === "new" && (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        อัปโหลดไฟล์ (ไม่จำเป็น)
                      </label>
                      <FileUpload onUploadSuccess={() => {
                        loadDocuments()
                        setMode("view")
                      }} />
                    </div>

                    <div className="flex items-center gap-4 my-4">
                      <hr className="flex-1 dark:border-gray-700" />
                      <span className="text-sm text-gray-400 dark:text-gray-500">หรือ พิมพ์เนื้อหาโดยตรง</span>
                      <hr className="flex-1 dark:border-gray-700" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="ชื่อเอกสาร"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={15}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="เนื้อหาเอกสาร..."
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Tip: Include FAQs, product information, policies, and common answers that AI can use to respond to customers.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Knowledge Base</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Add documents to train AI for auto-replying to customer questions.
                The AI will use this knowledge to provide accurate answers.
              </p>
              <button
                onClick={() => {
                  setMode("new")
                  setFormData({ title: "", content: "" })
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
              >
                + Add First Document
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSuccessModal(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-2xl mx-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Index สำเร็จ
              </h3>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                <p className="text-sm text-green-700 dark:text-green-400">
                  ✅ {successMessage}
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI Chatbot สามารถค้นหาข้อมูลจากเอกสารนี้ได้แล้ว
              </p>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white shadow hover:bg-green-700 transition-colors cursor-pointer"
                >
                  ตกลง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-2xl mx-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                ลบเอกสาร — {selectedDoc.title}
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  ⚠️ การลบเอกสารจะไม่สามารถกู้คืนได้
                  ข้อมูลและ Vector Index ที่เกี่ยวข้องจะถูกลบถาวร
                </p>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                คุณแน่ใจหรือไม่ที่จะลบ{" "}
                <strong className="text-gray-900 dark:text-gray-100">{selectedDoc.title}</strong>?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 text-sm font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50 text-gray-700 dark:text-gray-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDelete(selectedDoc.id)}
                  disabled={isDeleting}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white shadow hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  ลบเอกสาร
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}