import { generateRAGResponse } from "@/lib/rag-service"

async function main() {
  const question = "วิธีการสั่งซื้อสินค้า?"
  const response = await generateRAGResponse(question, [])
  console.log("Answer:", response.answer)
  console.log("Sources:", response.sources.map(s => s.metadata?.source))
}

main().catch(console.error)