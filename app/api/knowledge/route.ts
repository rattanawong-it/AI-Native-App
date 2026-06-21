import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

// GET — ดึงรายการเอกสารทั้งหมด
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
      createdBy: session.user.id,
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}