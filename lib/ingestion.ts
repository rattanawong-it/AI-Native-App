import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/openai"
import { splitTextIntoChunks } from "@/lib/text-splitter"

// Retry logic สำหรับ OpenAI rate limit (429)
async function generateEmbeddingWithRetry(
  text: string,
  maxRetries = 3
): Promise<number[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateEmbedding(text)
    } catch (error: any) {
      if (error?.code === "insufficient_quota") {
        throw new Error("OpenAI API หมดเครดิต! กรุณาเติมเงินที่ https://platform.openai.com/settings/billing")
      }

      if (error?.status === 429 && attempt < maxRetries) {
        const waitMs = 1000 * attempt * 2
        console.warn(`⏳ Rate limited — รอ ${waitMs / 1000} วินาที (attempt ${attempt}/${maxRetries})`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }

      throw error
    }
  }
  throw new Error("generateEmbedding failed after max retries")
}

/**
 * Ingest text content into Vector DB
 * แบ่ง content เป็น chunks → สร้าง embeddings → บันทึกลง pgVector
 */
export async function ingestText(
  content: string,
  options: {
    source?: string
    documentId?: string
  } = {}
) {
  const { source = "unknown", documentId } = options

  // 1. แบ่งเป็น chunks
  const chunks = splitTextIntoChunks(content, {
    chunkSize: 300,
    chunkOverlap: 50,
    source,
  })

  console.log(`📦 แบ่งได้ ${chunks.length} chunks จาก "${source}"`)

  // 2. สร้าง Embedding และบันทึกลง Database
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`)

    // สร้าง Embedding (มี retry logic)
    const embedding = await generateEmbeddingWithRetry(chunk.content)

    // แปลง embedding array เป็น string format ที่ pgVector ต้องการ
    const embeddingStr = `[${embedding.join(",")}]`

    // บันทึกลง Database ด้วย Raw SQL
    await prisma.$executeRaw`
      INSERT INTO document (id, content, metadata, embedding, "createdAt", "updatedAt")
      VALUES (
        ${`doc_${Date.now()}_${i}`},
        ${chunk.content},
        ${JSON.stringify({ ...chunk.metadata, documentId })}::jsonb,
        ${embeddingStr}::vector,
        NOW(),
        NOW()
      )
    `

    // หน่วงเวลาเพื่อไม่ให้ถูก rate limit
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log(`✅ Ingest "${source}" สำเร็จ (${chunks.length} chunks)`)
}