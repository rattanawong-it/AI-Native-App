// app/api/knowledge/[id]/route.ts
// อ่าน / แก้ / ลบเอกสารในคลัง RAG — admin เท่านั้น ให้ตรงกับหน้า /admin/knowledge
// เดิมตรวจแค่ว่ามี session ผู้ใช้ทุก role ที่ login แล้วจึงแก้และลบเอกสารได้

import { requireRole, ADMIN_ROLES } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// GET — ดึงเอกสารตาม ID
export async function GET(
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

  return NextResponse.json({ document })
}

// PUT — แก้ไขเอกสาร
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const { id } = await params
  const { title, content } = await request.json()

  const document = await prisma.knowledgeDocument.update({
    where: { id },
    data: {
      title,
      content,
      isIndexed: false, // ต้อง re-index ใหม่
    },
  })

  return NextResponse.json({ document })
}

// DELETE — ลบเอกสาร + ลบ chunks ใน Vector DB ด้วย
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const { id } = await params

  // 1. ลบ chunks ที่เกี่ยวข้องออกจาก document table (Vector DB)
  await prisma.$executeRaw`
    DELETE FROM document
    WHERE metadata->>'documentId' = ${id}
  `

  // 2. ลบเอกสารจาก knowledge_document table
  await prisma.knowledgeDocument.delete({ where: { id } })

  return NextResponse.json({ message: "Deleted successfully" })
}