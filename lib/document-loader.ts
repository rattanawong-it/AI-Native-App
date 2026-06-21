import fs from "fs"
import path from "path"
import { PDFParse } from "pdf-parse"
import { parse as csvParse } from "csv-parse/sync"

export interface LoadedDocument {
  content: string
  metadata: {
    source: string
    type: string
    pages?: number
  }
}

// อ่านไฟล์ TXT
export async function loadTextFile(filePath: string): Promise<LoadedDocument> {
  const content = fs.readFileSync(filePath, "utf-8")
  return {
    content,
    metadata: {
      source: path.basename(filePath),
      type: "txt",
    },
  }
}

// อ่านไฟล์ CSV — แปลงแต่ละ row เป็นข้อความภาษาธรรมชาติเพื่อให้ semantic search ทำงานได้ดี
export async function loadCSVFile(filePath: string): Promise<LoadedDocument> {
  const content = fs.readFileSync(filePath, "utf-8")
  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[]

  // แปลงแต่ละ row เป็นประโยคภาษาธรรมชาติ
  const naturalTextRows = records.map((row) => {
    return Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ")
  })

  return {
    content: naturalTextRows.join("\n\n"),
    metadata: {
      source: path.basename(filePath),
      type: "csv",
    },
  }
}

// อ่านไฟล์ PDF
export async function loadPDFFile(filePath: string): Promise<LoadedDocument> {
  const dataBuffer = fs.readFileSync(filePath)
  
  // 1. ส่ง { data: Buffer } เข้าไปใน Constructor
  const parser = new PDFParse({ data: dataBuffer })
  
  try {
    // 2. ใช้ getText() เพื่อดึงเนื้อหาข้อความ
    const textResult = await parser.getText()
    
    // 3. ใช้ getInfo() เพื่อดึงจำนวนหน้า (ใน v2 จะเก็บใน property .total)
    const infoResult = await parser.getInfo()

    return {
      content: textResult.text,
      metadata: {
        source: path.basename(filePath),
        type: "pdf",
        pages: infoResult.total, // เปลี่ยนจาก numpages เป็น total
      },
    }
  } catch (error) {
    console.error("Error parsing PDF:", error)
    throw error
  } finally {
    // 4. สำคัญมากใน v2: ต้องเรียก destroy() เสมอเพื่อคืนหน่วยความจำ
    await parser.destroy()
  }
}

// อ่านไฟล์อัตโนมัติตาม extension
export async function loadDocument(filePath: string): Promise<LoadedDocument> {
  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case ".txt":
        return loadTextFile(filePath)
    case ".csv":
        return loadCSVFile(filePath)
    case ".pdf":
      return loadPDFFile(filePath)
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }
}