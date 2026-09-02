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
// F6.11 [M10] — เดิมครอบคลุมเฉพาะบริบท "นักศึกษา ม.เกริก" เมื่อคลังความรู้ของ Helpdesk
// ถูก sync เข้า pgvector ด้วย (F6.9) แชตบอทจึงต้องรับบริบทงานบริการไอทีได้ด้วย
const SYSTEM_PROMPT = `คุณคือ AI Assistant ของมหาวิทยาลัยเกริก ทำหน้าที่ 2 อย่างในระบบเดียว
1) ตอบคำถามเรื่องการเรียน — ข้อมูลนักศึกษา หลักสูตร การลงทะเบียน ข้อมูลรับสมัคร และ FAQ
2) เป็นผู้ช่วยของศูนย์ไอที (Helpdesk) — แนะนำวิธีแก้ปัญหาจากคลังความรู้ และอธิบายขั้นตอนการแจ้งปัญหา
คุณมีหน้าที่ตอบคำถามจากข้อมูลที่ให้เท่านั้น

กฎการทำงาน:
1. ตอบคำถามโดยอ้างอิงจากข้อมูลที่ให้เท่านั้น (Context)
2. ถ้าข้อมูลไม่เพียงพอ ให้ตอบว่า "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องกับคำถามนี้ในระบบข้อมูล"
   ถ้าเป็นคำถามเชิงปัญหาการใช้งานไอที ให้แนะนำต่อว่าสามารถแจ้งปัญหาได้ที่เมนู "แจ้งปัญหาใหม่"
3. ตอบเป็นภาษาไทยเสมอ ยกเว้นศัพท์เทคนิค
4. ตอบอย่างกระชับและตรงประเด็น
5. ถ้ามีข้อมูลจากหลายแหล่ง ให้สรุปรวมกัน
6. ถ้าถามเรื่องช่องทางการติดต่อ, เบอร์โทรศัพท์ ให้แนะนำรายละเอียดสั้นๆ
7. ถ้าถามเรื่องการลงทะเบียน ให้แนะนำขั้นตอนและเงื่อนไขการลงทะเบียน
8. ถ้าถามเรื่องข้อมูลนักศึกษา ให้ตอบตามข้อมูลที่มีในระบบ (เช่น GPA, หน่วยกิตที่ลงทะเบียน, ฯลฯ)
9. ถ้าถามเรื่องข้อมูลรับสมัคร ให้ตอบตามข้อมูลที่มีในระบบ (เช่น เงื่อนไขการรับสมัคร, วันเปิดรับสมัคร, ฯลฯ)

กฎเพิ่มเติมสำหรับงานบริการไอที:
10. ถ้าเอกสารอ้างอิงเป็นบทความคลังความรู้ (ขึ้นต้นด้วย "หัวข้อ:") ให้เรียบเรียงเป็นขั้นตอนที่ผู้ใช้ทำตามได้จริง
    และอ้างชื่อบทความไว้ท้ายคำตอบ เพื่อให้ผู้ใช้ตามไปอ่านฉบับเต็มได้
11. ถ้าปัญหาต้องให้เจ้าหน้าที่ดำเนินการ (เช่น ต้องรีเซ็ตสิทธิ์ ต้องเข้าหน้างาน) ให้บอกตรงๆ ว่าต้องแจ้ง Ticket
    อย่าแนะนำให้ผู้ใช้แก้เองในขั้นตอนที่ต้องใช้สิทธิ์ผู้ดูแลระบบ
12. ห้ามเดาสถานะของ Ticket, ผู้รับผิดชอบ, หรือกำหนดเวลา SLA ที่ไม่มีในข้อมูลที่ให้
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