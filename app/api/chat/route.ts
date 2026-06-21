import { generateRAGResponse, ChatMessage } from "@/lib/rag-service"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message, sessionId } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: "Missing 'message'" },
        { status: 400 }
      )
    }

    // 1. ดึง Chat History จาก Database
    let history: ChatMessage[] = []
    if (sessionId) {
      const previousMessages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        take: 20, // จำกัด 20 messages ล่าสุด
      })

      history = previousMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))
    }

    // 2. สร้างคำตอบด้วย RAG
    const response = await generateRAGResponse(message, history, 5)

    // 3. บันทึก Messages ลง Database
    if (sessionId) {
      await prisma.chatMessage.createMany({
        data: [
          {
            sessionId,
            role: "user",
            content: message,
          },
          {
            sessionId,
            role: "assistant",
            content: response.answer,
            sources: response.sources.map((s) => ({
              source: s.metadata?.source,
              similarity: s.similarity,
            })),
          },
        ],
      })
    }

    return NextResponse.json({
      answer: response.answer,
      sources: response.sources.map((s) => ({
        content: s.content.substring(0, 200) + "...",
        source: s.metadata?.source,
        similarity: Math.round(s.similarity * 100) / 100,
      })),
      tokensUsed: response.tokensUsed,
    })
  } catch (error: any) {
    console.error("Chat API Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}