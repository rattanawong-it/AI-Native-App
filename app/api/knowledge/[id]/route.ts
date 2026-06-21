import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

// GET — ดึงเอกสารตาม ID
export async function GET(
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

  return NextResponse.json({ document })
}

// PUT — แก้ไขเอกสาร
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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