import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { ingestText } from "@/lib/ingestion"

// POST — Index เอกสารเข้า Vector Database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
  } catch (error: any) {
    console.error("Indexing error:", error)
    return NextResponse.json(
      { error: error.message || "Indexing failed" },
      { status: 500 }
    )
  }
}