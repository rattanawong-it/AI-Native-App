import { loadDocument } from "@/lib/document-loader"
import path from "path"

const files = [
  "documents/shop_info.txt",
  "documents/sample_product.csv",
  "documents/CustomerFAQ.pdf",
]

async function main() {
  for (const file of files) {
    const docPath = path.join(process.cwd(), file)
    console.log(`\n${"=".repeat(50)}`)
    console.log(`Loading: ${file}`)
    console.log("=".repeat(50))

    const document = await loadDocument(docPath)
    console.log(`Source: ${document.metadata.source}`)
    console.log(`Type: ${document.metadata.type}`)
    console.log(`Pages: ${document.metadata.pages || "N/A"}`)
    console.log(`Content Preview: ${document.content.slice(0, 200)}...`)
  }
}

main().catch(console.error)