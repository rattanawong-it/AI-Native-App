import { getOpenAIClient } from "@/lib/openai"
import { searchDocuments, SearchResult } from "@/lib/vector-search"

// กำหนดโครงสร้างของข้อความในแชท
export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

// โครงสร้างของคำตอบที่ฟังก์ชัน RAG จะส่งกลับ
export interface RAGResponse {
  answer: string
  sources: SearchResult[]
  tokensUsed: number
}

// System Prompt สำหรับ RAG Chatbot
const SYSTEM_PROMPT = `คุณคือ AI Assistant ของมหาวิทยาลัยเกริก ที่ตอบคำถามจากข้อมูลนักศึกษา หลักสูตร การลงทะเบียน ข้อมูลรับสมัคร และ FAQ
คุณมีหน้าที่ตอบคำถามจากข้อมูลที่ให้เท่านั้น

กฎการทำงาน:
1. ตอบคำถามโดยอ้างอิงจากข้อมูลที่ให้เท่านั้น (Context)
2. ถ้าข้อมูลไม่เพียงพอ ให้ตอบว่า "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องกับคำถามนี้ในระบบข้อมูล"
3. ตอบเป็นภาษาไทยเสมอ ยกเว้นศัพท์เทคนิค
4. ตอบอย่างกระชับและตรงประเด็น
5. ถ้ามีข้อมูลจากหลายแหล่ง ให้สรุปรวมกัน
6. ถ้าถามเรื่องหลักสูตร ให้แนะนำหลักสูตรที่มีในมหาวิทยาลัยเกริก  และรายละเอียดสั้นๆ
7. ถ้าถามเรื่องการลงทะเบียน ให้แนะนำขั้นตอนและเงื่อนไขการลงทะเบียน
8. ถ้าถามเรื่องข้อมูลนักศึกษา ให้ตอบตามข้อมูลที่มีในระบบ (เช่น GPA, หน่วยกิตที่ลงทะเบียน, ฯลฯ)
9. ถ้าถามเรื่องข้อมูลรับสมัคร ให้ตอบตามข้อมูลที่มีในระบบ (เช่น เงื่อนไขการรับสมัคร, วันเปิดรับสมัคร, ฯลฯ)
คุณจะได้รับข้อมูลอ้างอิงจากเอกสารข้อมูลในส่วน <context> ด้านล่าง`

export async function generateRAGResponse(
  userMessage: string,
  chatHistory: ChatMessage[] = [],
  topK: number = 5
): Promise<RAGResponse> {
  // 1. ค้นหาเอกสารที่เกี่ยวข้อง
  const searchResults = await searchDocuments(userMessage, topK)

  // 2. สร้าง Context จากผลการค้นหา
  const context = searchResults
    .map((doc, i) => `[เอกสาร ${i + 1}] (แหล่งที่มา: ${doc.metadata?.source || "N/A"}, ความเกี่ยวข้อง: ${Math.round(doc.similarity * 100)}%)\n${doc.content}`)
    .join("\n\n---\n\n")

  // 3. สร้าง Messages สำหรับ OpenAI
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    // เพิ่ม Chat History (จำกัด 10 messages ล่าสุด)
    ...chatHistory.slice(-10),
    {
      role: "user",
      content: `<context>\n${context}\n</context>\n\nคำถาม: ${userMessage}`,
    },
  ]

  // 4. เรียก OpenAI Chat API
  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3, // ต่ำ = ตอบตรงประเด็น, สูง = ตอบหลากหลาย
    max_tokens: 1000,
  })

  const answer = completion.choices[0]?.message?.content || "ไม่สามารถสร้างคำตอบได้"

  return {
    answer,
    sources: searchResults,
    tokensUsed: completion.usage?.total_tokens || 0,
  }
}