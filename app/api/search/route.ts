// app/api/search/route.ts
// ค้นเชิงความหมายทับคลังเอกสาร RAG โดยตรง (คนละเส้นกับ /api/search/global ที่หน้าค้นหารวมใช้)
//
// เดิมเส้นนี้เปิดสาธารณะ — ยิงได้โดยไม่ต้อง login และได้เนื้อหาทั้ง chunk กลับไป
// เท่ากับเปิดคลังเอกสารภายในทั้งหมดให้คนนอก จึงต้อง login และกรองตามสิทธิ์เหมือน /api/chat

import { NextRequest, NextResponse } from "next/server"
import { searchDocuments } from "@/lib/vector-search"
import { requireAuth, isStaff, badRequest } from "@/lib/rbac"

export async function POST(request: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { user } = guard

  try {
    const { query, topK = 5 } = await request.json()

    if (!query) {
      return badRequest("กรุณาระบุคำค้น")
    }

    // บทความ agent_only จะถูกหยิบมาแสดงเฉพาะเมื่อผู้ค้นเป็นเจ้าหน้าที่ขึ้นไป (F6.6)
    // เกณฑ์เดียวกับ app/api/chat/route.ts เพื่อไม่ให้สองเส้นทางนี้เพี้ยนจากกัน
    const results = await searchDocuments(query, topK, 0.3, {
      includeAgentOnly: isStaff(user),
    })

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        similarity: Math.round(r.similarity * 100) / 100,
      })),
      totalResults: results.length,
    })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "ค้นหาไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 }
    )
  }
}
