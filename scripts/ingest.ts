import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/openai"
import { loadDocument } from "@/lib/document-loader"
import { splitTextIntoChunks } from "@/lib/text-splitter"
import path from "path"
import fs from "fs"

// Retry logic สำหรับ OpenAI rate limit (429)
async function generateEmbeddingWithRetry(
  text: string,
  maxRetries = 3
): Promise<number[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateEmbedding(text)
    } catch (error: any) {
      // หมดเครดิต — ไม่มีประโยชน์ retry
      if (error?.code === "insufficient_quota") {
        console.error("\n❌ OpenAI API หมดเครดิต!")
        console.error("   กรุณาเติมเงินที่: https://platform.openai.com/settings/billing")
        process.exit(1)
      }

      // Rate limit — รอแล้ว retry
      if (error?.status === 429 && attempt < maxRetries) {
        const waitMs = 1000 * attempt * 2
        console.warn(`   ⏳ Rate limited — รอ ${waitMs / 1000} วินาที (attempt ${attempt}/${maxRetries})`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }

      throw error
    }
  }
  throw new Error("generateEmbedding failed after max retries")
}

async function ingestDocument(filePath: string) {
  console.log(`📄 กำลังอ่านไฟล์: ${filePath}`)

  // 1. อ่านเอกสาร
  const document = await loadDocument(filePath)
  console.log(`   ✅ อ่านเนื้อหาได้ ${document.content.length} ตัวอักษร`)

  // 2. แบ่งเป็น chunks
  const chunks = splitTextIntoChunks(document.content, {
    chunkSize: 300,
    chunkOverlap: 50,
    source: document.metadata.source,
  })
  console.log(`   📦 แบ่งได้ ${chunks.length} chunks`)

  // 3. สร้าง Embedding และบันทึกลง Database
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`   🔄 Processing chunk ${i + 1}/${chunks.length}...`)

    // สร้าง Embedding (มี retry logic + quota check)
    const embedding = await generateEmbeddingWithRetry(chunk.content)

    // แปลง embedding array เป็น string format ที่ pgVector ต้องการ: [0.1, 0.2, ...]
    const embeddingStr = `[${embedding.join(",")}]`

    // บันทึกลง Database ด้วย Raw SQL (เพราะ Prisma ยังไม่รองรับ vector type)
    await prisma.$executeRaw`
      INSERT INTO document (id, content, metadata, embedding, "createdAt", "updatedAt")
      VALUES (
        ${`doc_${Date.now()}_${i}`},
        ${chunk.content},
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${embeddingStr}::vector,
        NOW(),
        NOW()
      )
    `

    // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ถูก rate limit โดย OpenAI
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log(`   ✅ บันทึกสำเร็จ!`)
}

async function main() {
  const docsDir = path.join(process.cwd(), "documents")

  // ตรวจสอบว่ามีโฟลเดอร์ documents หรือยัง
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true })
    console.log("📁 สร้างโฟลเดอร์ documents/ แล้ว")
    console.log("   กรุณาใส่ไฟล์ TXT, CSV หรือ PDF ในโฟลเดอร์นี้แล้วรันอีกครั้ง")
    return
  }

  // อ่านไฟล์ทั้งหมดในโฟลเดอร์ documents
  const files = fs.readdirSync(docsDir).filter((f) => {
    const ext = path.extname(f).toLowerCase()
    return ext === ".pdf" || ext === ".txt" || ext === ".csv"
  })

  if (files.length === 0) {
    console.log("❌ ไม่พบไฟล์ TXT, CSV หรือ PDF ในโฟลเดอร์ documents/")
    return
  }

  console.log(`🚀 เริ่มทำ Ingestion สำหรับ ${files.length} ไฟล์\n`)

  // ลบข้อมูลเก่าออกก่อน เพื่อป้องกันข้อมูลซ้ำเมื่อรันซ้ำ
  const deleted = await prisma.$executeRaw`DELETE FROM document`
  console.log(`🗑️  ลบข้อมูลเก่า ${deleted} รายการ\n`)

  for (const file of files) {
    const filePath = path.join(docsDir, file)
    await ingestDocument(filePath)
    console.log("")
  }

  console.log("🎉 Ingestion เสร็จสมบูรณ์!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())