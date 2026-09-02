import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/openai"

export interface SearchResult {
  id: string
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- baseline เดิม: metadata เป็น jsonb อิสระ การรัดชนิดตรงนี้กระทบ 3 ไฟล์นอกขอบเขตเฟส 6
  metadata: any
  similarity: number
}

export async function searchDocuments(
  query: string,
  topK: number = 5,
  matchThreshold: number = 0.3 // ค่า similarity ขั้นต่ำ
): Promise<SearchResult[]> {
  // 1. แปลงคำถามเป็น Embedding
  const queryEmbedding = await generateEmbedding(query)

  // แปลง embedding array เป็น string format ที่ pgVector ต้องการ: [0.1, 0.2, ...]
  const embeddingStr = `[${queryEmbedding.join(",")}]`

  // 2. ค้นหาด้วย Cosine Similarity + filter ด้วย threshold
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      content,
      metadata,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM document
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `

  return results
}
/**
 * ค้นหาเฉพาะ chunk ที่มาจากบทความ Knowledge Base (F6.12)
 * ใช้แนะนำบทความที่เกี่ยวข้องในหน้า Ticket — กรองด้วย prefix ของ metadata.source
 * ที่ lib/kb-sync.ts ตั้งไว้ตอน publish ("kb:<articleId>")
 */
export async function searchKbArticles(
  query: string,
  topK: number = 3,
  matchThreshold: number = 0.3
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = `[${queryEmbedding.join(",")}]`

  return prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      content,
      metadata,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM document
    WHERE embedding IS NOT NULL
      AND metadata->>'source' LIKE 'kb:%'
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `
}
