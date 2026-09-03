// app/api/knowledge/route.ts
// คลังเอกสาร RAG — ใช้จากหน้า /admin/knowledge เท่านั้น จึงเป็น admin ทุก method
//
// เดิมตรวจแค่ว่ามี session ผู้ใช้ role student ที่ login แล้วจึงอ่านและสร้างเอกสาร
// ที่แชตบอทใช้ตอบได้ ทั้งที่หน้าจอกันไว้ที่ admin (docs/spec.md §7.2 กลุ่ม 9)

import { requireRole, ADMIN_ROLES } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// GET — ดึงรายการเอกสารทั้งหมด
export async function GET(request: NextRequest) {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search") || ""

  const documents = await prisma.knowledgeDocument.findMany({
    where: search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ documents })
}

// POST — สร้างเอกสารใหม่
export async function POST(request: NextRequest) {
  const guard = await requireRole([...ADMIN_ROLES])
  if (!guard.ok) return guard.response

  const { title, content } = await request.json()

  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    )
  }

  const document = await prisma.knowledgeDocument.create({
    data: {
      title,
      content,
      fileType: "manual",
      createdBy: guard.user.id,
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}