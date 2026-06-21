import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/openai"

export interface SearchResult {
  id: string
  content: string
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