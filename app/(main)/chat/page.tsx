import ChatContent from '@/app/(main)/chat/ChatContent'

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "AI Chat",
    description:
        "AI Chat — ระบบแชท AI ครบวงจร รองรับ Session Management, Memory (server-side history), Streaming (SSE), และ Chat History Sidebar ที่ใช้งานง่ายและมีประสิทธิภาพ เหมาะสำหรับการสร้างแชทบอท, ผู้ช่วยส่วนตัว, หรือระบบตอบคำถามอัจฉริยะ",
    keywords: [
        "AI Chat",
        "แชท AI",
        "AI Native App",
        "ศูนย์กลางการจัดการ",
        "Knowledge Base",
        "AI Chat",
        "สถิติการใช้งาน",
        "ระบบจัดการ AI",
    ],
}

export default function page() {
  return <ChatContent />
}