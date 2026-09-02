import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/openai"

export interface SearchResult {
  id: string
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- baseline เดิม: metadata เป็น jsonb อิสระ การรัดชนิดตรงนี้กระทบ 3 ไฟล์นอกขอบเขตเฟส 6
  metadata: any
  similarity: number
}

export interface DocumentSearchOptions {
  /// true = ค้นบทความ agent_only ด้วย — ส่งได้เฉพาะเมื่อผู้ถามเป็นเจ้าหน้าที่ขึ้นไป
  includeAgentOnly?: boolean
}

/// ตัด chunk ที่มาจากบทความที่ผู้ใช้ทั่วไปไม่มีสิทธิ์อ่านออก
///
/// chunk ของ KB มี metadata.source = "kb:<articleId>" (ดู lib/kb-sync.ts)
/// จึงย้อนกลับไปหาบทความต้นทางได้ เอกสารที่อัปโหลดเข้ามาเอง (source เป็นชื่อไฟล์) ไม่ถูกกรอง
///
/// COALESCE จำเป็น — ถ้า metadata ไม่มีคีย์ source ค่าจะเป็น NULL
/// ทำให้ NULL NOT LIKE ... คืน NULL แล้วแถวนั้นจะถูกตัดทิ้งทั้งที่ไม่ใช่บทความ KB
///
/// เงื่อนไข status = published กัน vector กำพร้าจากบทความที่ถูกถอนไปแล้ว
/// แต่ลบ chunk ไม่สำเร็จ (เช่น embedding API ล่มกลางคัน)
const PUBLIC_ONLY_FILTER = Prisma.sql`
      AND (
        COALESCE(metadata->>'source', '') NOT LIKE 'kb:%'
        OR EXISTS (
          SELECT 1 FROM kb_article a
          WHERE a.id = substring(metadata->>'source' FROM 4)
            AND a.status = 'published'
            AND a.visibility = 'all'
        )
      )`

export async function searchDocuments(
  query: string,
  topK: number = 5,
  matchThreshold: number = 0.3, // ค่า similarity ขั้นต่ำ
  options: DocumentSearchOptions = {}
): Promise<SearchResult[]> {
  // ค่าตั้งต้นคือ "กรอง" โดยเจตนา — ผู้เรียกที่ลืมส่ง option จะได้พฤติกรรมที่ปลอดภัยเสมอ
  const visibilityFilter = options.includeAgentOnly ? Prisma.empty : PUBLIC_ONLY_FILTER

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
      ${visibilityFilter}
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
