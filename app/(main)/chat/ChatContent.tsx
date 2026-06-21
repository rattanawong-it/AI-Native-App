"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { sendChatMessage } from "@/lib/chat-client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ChatSession {
  id: string
  title: string | null
  updatedAt: string
  messages?: { id: string; role: string; content: string; createdAt: string }[]
}
    
export default function ChatContent() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSidebar, setActiveSidebar] = useState(true)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Redirect ถ้าไม่ได้ล็อกอิน
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth/signin")
    }
  }, [session, isPending, router])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // โหลด Sessions
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const res = await fetch("/api/chat/sessions")
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error("Failed to load sessions:", error)
    } finally {
      setIsLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    if (session) loadSessions()
  }, [session, loadSessions])

  // โหลด Messages ของ Session ที่เลือก
  async function loadSessionMessages(sessionId: string) {
    setIsLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`)
      const data = await res.json()

      if (data.session?.messages) {
        const loadedMessages: Message[] = data.session.messages.map(
          (msg: { id: string; role: string; content: string; createdAt: string }) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: new Date(msg.createdAt),
          })
        )
        setMessages(loadedMessages)
        setActiveSessionId(sessionId)
      }
    } catch (error) {
      console.error("Failed to load messages:", error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // สร้าง Session ใหม่
  async function createNewSession(title?: string): Promise<string | null> {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "สนทนาใหม่" }),
      })
      const data = await res.json()
      if (data.session) {
        await loadSessions()
        return data.session.id
      }
    } catch (error) {
      console.error("Failed to create session:", error)
    }
    return null
  }

  // อัพเดท title ของ session
  async function updateSessionTitle(sessionId: string, title: string) {
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      await loadSessions()
    } catch (error) {
      console.error("Failed to update session title:", error)
    }
  }

  // ลบ Session
  async function deleteSession(sessionId: string) {
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" })
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
      await loadSessions()
    } catch (error) {
      console.error("Failed to delete session:", error)
    }
  }

  // เริ่มสนทนาใหม่
  function handleNewChat() {
    setActiveSessionId(null)
    setMessages([])
    setInput("")
    inputRef.current?.focus()
  }

  // ส่งข้อความ
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userText = input.trim()

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: new Date(),
    }

    const aiMsgId = `ai_${Date.now()}`
    const aiMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, aiMsg])
    setInput("")
    setIsLoading(true)

    try {
      // สร้าง session ใหม่ถ้ายังไม่มี
      let currentSessionId = activeSessionId
      if (!currentSessionId) {
        // ใช้ข้อความแรกเป็น title (ตัดไม่เกิน 50 ตัวอักษร)
        const title = userText.length > 50 ? userText.substring(0, 50) + "..." : userText
        currentSessionId = await createNewSession(title)
        if (currentSessionId) {
          setActiveSessionId(currentSessionId)
        }
      }

      // ส่งข้อความผ่าน Streaming API
      await sendChatMessage(
        userText,
        currentSessionId,
        (updatedContent) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, content: updatedContent } : msg
            )
          )
        }
      )

      // รีโหลด sessions เพื่ออัปเดต updatedAt
      await loadSessions()
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? { ...msg, content: `❌ เกิดข้อผิดพลาด: ${error.message}` }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100%+3rem)] -m-6 bg-gray-50 dark:bg-gray-950">
      {/* Sidebar — ประวัติการสนทนา */}
      <div
        className={`${
          activeSidebar ? "w-72" : "w-0"
        } bg-gray-900 dark:bg-gray-900 text-white transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {/* New Chat Button */}
        <div className="p-4 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 px-4 border border-gray-600 rounded-lg hover:bg-gray-700 transition text-sm flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            สนทนาใหม่
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <p className="text-xs text-gray-400 px-2 mb-2">ประวัติการสนทนา</p>

          {isLoadingSessions && sessions.length === 0 && (
            <div className="text-xs text-gray-500 text-center py-4">กำลังโหลด...</div>
          )}

          {sessions.length === 0 && !isLoadingSessions && (
            <div className="text-xs text-gray-500 text-center py-4">ยังไม่มีประวัติ</div>
          )}

          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center rounded-lg transition ${
                activeSessionId === s.id
                  ? "bg-gray-700"
                  : "hover:bg-gray-800"
              }`}
            >
              <button
                onClick={() => loadSessionMessages(s.id)}
                className="flex-1 text-left px-3 py-2.5 text-sm truncate"
                title={s.title || "สนทนาใหม่"}
              >
                <span className="mr-2">💬</span>
                {s.title || "สนทนาใหม่"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(s.id)
                }}
                className="opacity-0 group-hover:opacity-100 px-2 py-1 text-gray-400 hover:text-red-400 transition"
                title="ลบสนทนา"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 text-xs text-gray-500 shrink-0">
          {sessions.length} สนทนา
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSidebar(!activeSidebar)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-semibold text-lg text-gray-900 dark:text-white">AI Chatbot</h1>
            {activeSessionId && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                ● เชื่อมต่อแล้ว
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {session?.user?.name}
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Loading Session Messages */}
          {isLoadingMessages && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400 flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                กำลังโหลดข้อความ...
              </div>
            </div>
          )}

          {/* Empty State */}
          {messages.length === 0 && !isLoadingMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300">AI Assistant</h2>
              <p className="mt-2 max-w-md dark:text-gray-400">
                ถามอะไรเกี่ยวกับข้อมูลของมหาวิทยาลัยเกริกได้เลยครับ
                <br />
                <span className="text-sm">ระบบจะจดจำบทสนทนาและใช้ข้อมูลจาก Knowledge Base ในการตอบ</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  "ขั้นตอนการสมัครเรียน?",
                  "หลักสูตรที่เปิดทั้งหมดในมหาวิทยาลัยเกริก?",
                  "วิธีการลงทะเบียนเรียน?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="flex items-start gap-3 max-w-2xl">
                {/* Avatar */}
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-sm">
                    🤖
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-5 py-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-3">
                              <table className="w-full border-collapse rounded-lg overflow-hidden shadow-sm border border-gray-300 dark:border-gray-600">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-200 text-sm">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                              {children}
                            </td>
                          ),
                          tr: ({ children }) => (
                            <tr className="even:bg-gray-50 dark:even:bg-gray-700/50 hover:bg-blue-50/40 dark:hover:bg-gray-700/70 transition-colors">
                              {children}
                            </tr>
                          ),
                          p: ({ children }) => (
                            <p className="my-2 leading-relaxed">{children}</p>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
                          ),
                          code: ({ children, className }) => {
                            const isBlock = className?.includes("language-")
                            return isBlock ? (
                              <code className={`${className} block bg-gray-900 text-green-300 rounded-lg p-3 my-2 text-xs overflow-x-auto`}>
                                {children}
                              </code>
                            ) : (
                              <code className="bg-gray-100 dark:bg-gray-700 text-pink-600 dark:text-pink-400 rounded px-1.5 py-0.5 text-xs font-mono">
                                {children}
                              </code>
                            )
                          },
                          pre: ({ children }) => (
                            <pre className="my-2">{children}</pre>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 my-3">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 my-2">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 my-2">{children}</h3>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-2 my-2 italic text-gray-600 dark:text-gray-300 rounded-r">
                              {children}
                            </blockquote>
                          ),
                          a: ({ children, href }) => (
                            <a href={href} className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                          hr: () => <hr className="my-3 border-gray-200 dark:border-gray-600" />,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}
                  <p
                    className={`text-xs mt-1.5 ${
                      message.role === "user" ? "text-blue-200" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Avatar */}
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 text-sm">
                    👤
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && messages.length > 0 && !messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-sm">
                  🤖
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="พิมพ์คำถามของคุณ..."
              disabled={isLoading}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              ส่ง
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
            AI อาจตอบผิดพลาดได้ กรุณาตรวจสอบข้อมูลสำคัญอีกครั้ง
          </p>
        </div>
      </div>
    </div>
  )
}