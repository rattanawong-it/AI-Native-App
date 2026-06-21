export interface TextChunk {
  content: string
  metadata: {
    source: string
    chunkIndex: number
    totalChunks?: number
  }
}

export function splitTextIntoChunks(
  text: string,
  options: {
    chunkSize?: number     // ขนาด chunk (จำนวนตัวอักษร)
    chunkOverlap?: number  // ส่วนที่ซ้อนทับกัน
    source?: string        // ชื่อไฟล์ต้นทาง
  } = {}
): TextChunk[] {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    source = "unknown",
  } = options

  const chunks: TextChunk[] = []

  // แบ่งตามย่อหน้าก่อน
  const paragraphs = text.split(/\n\s*\n/)
  let currentChunk = ""
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    // ถ้าเพิ่มย่อหน้าใหม่แล้วเกิน chunkSize
    if (currentChunk.length + trimmed.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          source,
          chunkIndex,
        },
      })
      chunkIndex++

      // เก็บส่วน overlap
      const words = currentChunk.split(" ")
      const overlapWords = words.slice(-Math.floor(chunkOverlap / 5))
      currentChunk = overlapWords.join(" ") + "\n\n" + trimmed
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed
    }
  }

  // เพิ่ม chunk สุดท้าย
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        source,
        chunkIndex,
      },
    })
  }

  // อัปเดต totalChunks
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      totalChunks: chunks.length,
    },
  }))
}