import { loadDocument } from "@/lib/document-loader"
import path from "path"
import { splitTextIntoChunks } from "@/lib/text-splitter"

const files = [
  "documents/shop_info.txt",
  "documents/sample_product.csv",
  "documents/CustomerFAQ.pdf",
]

async function main() {
  for (const file of files) {
    const docPath = path.join(process.cwd(), file)
    console.log(`\n${"=".repeat(60)}`)
    console.log(`Loading: ${file}`)
    console.log("=".repeat(60))

    const document = await loadDocument(docPath)

    const chunks = splitTextIntoChunks(document.content, {
      chunkSize: 100,
      chunkOverlap: 20,
      source: document.metadata.source,
    })

    console.log(`Total Chunks: ${chunks.length}`)
    chunks.forEach((chunk, index) => {
      console.log(`\n--- Chunk ${index + 1} ---`)
      console.log(`Content: ${chunk.content}`)
      console.log(`Metadata: ${JSON.stringify(chunk.metadata)}`)
    })
  }
}

main().catch(console.error)