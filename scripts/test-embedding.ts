import { generateEmbedding } from "../lib/openai"

async function main() {
  const embedding = await generateEmbedding("สวัสดีครับ นี่คือตัวอย่างข้อความ")
  console.log(`Dimensions: ${embedding.length}`)  // 1536
  console.log(`First 5 values: ${embedding.slice(0, 5)}`)
}

main().catch(console.error)
