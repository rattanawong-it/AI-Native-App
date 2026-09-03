// app/api/knowledge/[id]/index/route.ts
// สั่ง index เอกสารเข้า vector database ใหม่ — admin เท่านั้น
// งานนี้กินโควตา embedding API จึงไม่ควรเปิดให้ผู้ใช้ทั่วไปสั่งได้

import { requireRole, ADMIN_ROLES } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { ingestText } from "@/lib/ingestion"

// POST — Index เอกสารเข้า Vector Database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const { id } = await params

  const document = await prisma.knowledgeDocument.findUnique({
    where: { id },
  })

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    // ลบ chunks เก่าออกก่อน (ป้องกันข้อมูลซ้ำเมื่อ re-index)
    await prisma.$executeRaw`
      DELETE FROM document
      WHERE metadata->>'documentId' = ${id}
    `

    // เรียก Ingestion Pipeline
    // แบ่ง content เป็น chunks → สร้าง embeddings → บันทึกลง pgVector
    await ingestText(document.content, {
      source: document.source || document.title,
      documentId: document.id,
    })

    // อัปเดตสถานะ
    await prisma.knowledgeDocument.update({
      where: { id },
      data: { isIndexed: true },
    })

    return NextResponse.json({
      message: `เอกสาร "${document.title}" ถูก index เข้า Vector DB เรียบร้อย`,
    })
  } catch (error) {
    console.error("Indexing error:", error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : "") || "Indexing failed" },
      { status: 500 }
    )
  }
}