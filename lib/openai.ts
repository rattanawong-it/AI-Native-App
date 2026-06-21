import OpenAI from "openai"

// Lazily create the OpenAI client to avoid throwing during module evaluation
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable. Set it before calling OpenAI client functions."
    )
  }

  return new OpenAI({ apiKey })
}

// ฟังก์ชันสร้าง Embedding จากข้อความ
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient()

  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input: text,
  })

  return response.data[0].embedding
}