import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

// GET - ดึง Chat Sessions ทั้งหมดของผู้ใช้
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const chatSessions = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  })

  return NextResponse.json({ sessions: chatSessions })
}

// POST - สร้าง Chat Session ใหม่
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title } = await request.json()

  const chatSession = await prisma.chatSession.create({
    data: {
      userId: session.user.id,
      title: title || "สนทนาใหม่",
    },
  })

  return NextResponse.json({ session: chatSession })
}