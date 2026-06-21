import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

// ฟังก์ชันดึงข้อความจากไฟล์ต่างๆ
async function extractTextFromFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "txt":
      return buffer.toString("utf-8")

    case "csv":
      // แปลง CSV เป็นข้อความ แต่ละ row เป็น 1 บรรทัด
      return buffer.toString("utf-8")

    case "pdf":
      // ใช้ pdf-parse v2 สำหรับ PDF
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer })
      try {
        const textResult = await parser.getText()
        return textResult.text
      } finally {
        await parser.destroy()
      }

    default:
      throw new Error(`Unsupported file type: ${extension}`)
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const title = formData.get("title") as string | null

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }

  // ตรวจสอบประเภทไฟล์
  const allowedTypes = ["pdf", "csv", "txt"]
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !allowedTypes.includes(extension)) {
    return NextResponse.json(
      { error: "Supported file types: PDF, CSV, TXT" },
      { status: 400 }
    )
  }

  // ตรวจสอบขนาดไฟล์ (จำกัด 10MB)
  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File size must not exceed 10MB" },
      { status: 400 }
    )
  }

  try {
    // อ่านไฟล์เป็น Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // ดึงข้อความจากไฟล์
    const content = await extractTextFromFile(buffer, file.name)

    if (!content.trim()) {
      return NextResponse.json(
        { error: "ไม่สามารถดึงข้อความจากไฟล์ได้" },
        { status: 400 }
      )
    }

    // บันทึกลง Database
    const document = await prisma.knowledgeDocument.create({
      data: {
        title: title || file.name.replace(/\.[^/.]+$/, ""),
        content,
        source: file.name,
        fileType: extension,
        fileSize: file.size,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json(
      {
        document,
        message: `อัปโหลด ${file.name} สำเร็จ (${content.length} ตัวอักษร)`,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("File upload error:", error)
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    )
  }
}