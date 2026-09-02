# Phase 6 — Knowledge Base + RAG Sync

> **สถานะ:** เสร็จ · branch `feat/itsm-phase-6` · ครอบคลุม F6.1–F6.13 ครบ 13 ข้อ
> **พึ่งพา:** Phase 1 (Helpdesk) — เสร็จแล้ว
> **วันที่:** 2 กันยายน 2569

---

## 1. สิ่งที่ทำ

ระบบคลังความรู้ที่ต่อเข้ากับ RAG เดิมของแอป — เจ้าหน้าที่เขียนบทความเป็น Markdown
หัวหน้างานตรวจแล้วเผยแพร่ พอเผยแพร่ปุ๊บบทความจะถูก chunk + embed เข้า pgvector ทันที
ทำให้แชตบอทตัวเดิมตอบคำถามวิธีแก้ปัญหาไอทีได้ โดยไม่ต้องอัปโหลดไฟล์เอกสารแยกอีกชุด

### ของที่มีอยู่แล้วตั้งแต่ Phase 0 (ไม่ต้องทำซ้ำ)

`KbArticle` / `KbFeedback` อยู่ใน `schema.prisma` แล้ว · statement `kb` อยู่ใน `lib/permissions.ts` แล้ว ·
ลิงก์ `/service/kb` อยู่ใน sidebar แล้ว · `react-markdown` + `remark-gfm` + shadcn components ติดตั้งครบ

**ผลคือเฟสนี้ไม่ต้องแตะ `schema.prisma` ไม่มี migration และไม่เพิ่ม dependency ใดๆ**

---

## 2. ไฟล์ที่สร้างใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/kb-workflow.ts` | 4 สถานะ + ตารางการเปลี่ยนสถานะ + slug ที่คงอักษรไทย |
| `lib/kb-schema.ts` | zod schema ทุก payload ของ `api/kb` (NFR2) |
| `lib/kb-service.ts` | select shape, ตัวกรอง/เรียง, สิทธิ์ระดับแถว (NFR3), ประกอบข้อความก่อนเข้า RAG |
| `lib/kb-sync.ts` | สะพาน KB → Vector DB (publish/un-publish) |
| `lib/kb-types.ts` | ชนิดข้อมูลฝั่ง client |
| `app/api/kb/route.ts` | GET รายการ · POST สร้าง |
| `app/api/kb/[id]/route.ts` | GET อ่าน (id หรือ slug) · PATCH แก้ · DELETE ลบ |
| `app/api/kb/[id]/publish/route.ts` | เปลี่ยนสถานะ + sync เข้า/ออก pgvector |
| `app/api/kb/[id]/feedback/route.ts` | โหวตมีประโยชน์ / ไม่มีประโยชน์ |
| `app/api/kb/suggest/route.ts` | vector search แนะนำบทความจาก Ticket |
| `app/(main)/service/kb/**` | หน้ารายการ + หน้าอ่านบทความ |
| `app/(main)/management/kb/**` | หน้าจัดการ + เขียนใหม่ + แก้ไข |
| `components/kb/kb-badges.tsx` | ป้ายสถานะ / การมองเห็น / แท็ก |
| `components/kb/kb-editor.tsx` | ฟอร์มเขียน-แก้ + ดูตัวอย่าง Markdown |
| `components/kb/kb-ticket-panel.tsx` | การ์ดแนะนำบทความ + ปุ่มบันทึกองค์ความรู้ |

## 3. ไฟล์เดิมที่แก้

| ไฟล์ | อยู่ในตาราง M? | แก้อะไร |
|---|---|---|
| `lib/rag-service.ts` | **M10** ✅ ขออนุมัติแล้ว | `SYSTEM_PROMPT` เพิ่มบทบาท Helpdesk + กฎข้อ 10–12 (กฎเดิม 9 ข้อคงครบ) |
| `app/(main)/_components/sidebar/sidebar-data.ts` | **M5** ✅ ขออนุมัติแล้ว | เพิ่มเมนู "จัดการบทความ" จำกัดสิทธิ์ `STAFF` |
| `lib/ingestion.ts` | นอกตาราง ✅ ขออนุมัติรายกรณี | เพิ่ม `deleteVectorsByDocumentId()` + `reingestDocument()` · แทน `catch (error: any)` ด้วย `unknown` |
| `lib/vector-search.ts` | นอกตาราง ✅ ขออนุมัติรายกรณี | เพิ่ม `searchKbArticles()` |
| `app/(main)/service/tickets/[id]/TicketDetailContent.tsx` | นอกตาราง ✅ ขออนุมัติรายกรณี | เรียกใช้การ์ดแนะนำ + ปุ่มบันทึกองค์ความรู้ (แก้ 13 บรรทัด) |

---

## 4. การตัดสินใจเชิงออกแบบที่ควรรู้

**แยก `publish` ออกจาก `PATCH`** — การเปลี่ยนสถานะมีผลข้างเคียงที่การแก้ไขธรรมดาไม่มี
(เข้า published ต้อง embed, ออกจาก published ต้องลบ vector) การแยกเส้นทางทำให้ไม่มีทาง
ที่บทความจะกลายเป็น published โดยข้ามขั้นตอน index

**`lib/kb-sync.ts` จงใจไม่ throw** — การ embed ต้องเรียก OpenAI ซึ่งล่มหรือหมดเครดิตได้
ถ้าปล่อยให้ throw การกดเผยแพร่จะล้มทั้งรายการทั้งที่สถานะควรเปลี่ยนสำเร็จ
จึงคืน `{ ok, error }` แล้วให้ API ส่งต่อเป็น `syncWarning` ให้ UI เตือนว่า
"เผยแพร่แล้ว แต่ยังไม่เข้าคลังค้นหา" พร้อมป้าย `KbIndexBadge` สีแดงบนรายการ

**`reingestDocument()` ลบก่อน insert เสมอ** — ของเดิมใน `ingestion.ts` มีแต่ INSERT
ถ้าแก้บทความแล้ว ingest ทับ จะเหลือ chunk เวอร์ชันเก่าค้างใน pgvector และแชตบอทจะตอบข้อมูลเก่าปนใหม่

**ตัด `sourceTicketId` ทิ้ง** — `KbArticle` ไม่มีฟิลด์นี้ และ F6.13 ต้องการแค่ prefill เนื้อหา
จึงส่งค่าผ่าน query string แทนการเพิ่มฟิลด์ ไม่ต้องทำ migration

**การโหวตซ้ำไม่ทำให้ตัวนับเฟ้อ** — เก็บโหวตเดิมไว้แล้วคำนวณส่วนต่างใน `$transaction` เดียว
เปลี่ยนใจจาก "มีประโยชน์" เป็น "ไม่มีประโยชน์" จะลบของเดิมออกจากตัวนับพร้อมกับเพิ่มอันใหม่

---

## 5. ผลตรวจเกต (§16.4)

| เกต | ผล |
|---|---|
| G1 ไฟล์ที่ commit ถูกต้อง | ✅ 7 commit แยกเรื่อง ไม่มีไฟล์แปลกปลอม |
| G2 `prisma validate` | — ไม่แตะ `schema.prisma` |
| G3 `prisma generate` | — ไม่แตะ `schema.prisma` |
| G4 `npx tsc --noEmit` | ✅ 0 error (รันทุก commit) |
| G5 `eslint` ไฟล์ที่แตะ | ✅ 0 error |
| G6 `pnpm build` | ✅ ผ่าน — 5 route ใหม่ขึ้นครบ |
| G7 อยู่ในขอบเขต | ✅ ไฟล์นอก M1–M13 ทั้ง 3 ไฟล์ขออนุมัติรายกรณีแล้ว |

---

## 6. ของค้าง

1. **ยังไม่ได้ทดสอบกับ OpenAI จริง** — เส้นทาง publish → embed → pgvector ผ่าน typecheck
   และ build แล้ว แต่ยังไม่ได้รันกับ `OPENAI_API_KEY` จริง ควรทดสอบ 1 รอบ:
   สร้างบทความ → เผยแพร่ → ถามแชตบอทด้วยคำในบทความ → ถอนบทความ → ถามซ้ำแล้วต้องไม่เจอ

2. **`SearchResult.metadata` ยังเป็น `any`** — ใส่ `eslint-disable-next-line` พร้อมเหตุผลกำกับไว้
   การรัดชนิดให้ถูกต้องกระทบ `app/api/chat/route.ts`, `app/api/chat/stream/route.ts`,
   `app/api/line/webhook/route.ts` ซึ่งอยู่นอกขอบเขตเฟสนี้ — ควรเก็บในเฟสที่แตะไฟล์เหล่านั้นอยู่แล้ว

3. **บทความเก่าที่เผยแพร่ก่อนเฟสนี้ไม่มี** — ระบบเพิ่งเกิด จึงยังไม่มีปัญหา backfill
   แต่ถ้าอนาคตแก้สูตร `buildArticleDocumentText()` ต้องมีสคริปต์ re-index บทความ published ทั้งหมด

4. **ยังไม่มีหน้าจัดการหมวดหมู่เฉพาะของ KB** — ใช้ `ServiceCategory` ร่วมกับ Ticket
   ถ้าอนาคตต้องการหมวดหมู่คนละชุด ต้องเพิ่ม model ใหม่

5. **UI ฝั่ง landing/help ยังเขียนว่าใช้ OpenAI/GPT-4o** (`app/(landing)/*`, `HelpContent.tsx`,
   `SettingContent.tsx` มี dropdown เลือกรุ่น GPT ที่เป็น `useState` เปล่าๆ ไม่ได้ต่อกับ backend)
   — เป็นข้อความโฆษณา/ค่าที่ไม่ได้ใช้จริง ไม่กระทบการทำงาน แต่ควรเก็บกวาดในเฟส 8 ที่เขียนหน้าเหล่านี้ใหม่อยู่แล้ว

---

## 7. คำถามที่ต้องการคำตอบก่อนเฟสถัดไป

1. **บทความ `agent_only` ควรเข้า RAG ไหม?** ตอนนี้เข้าทั้งหมด — แชตบอทจึงอาจดึงเนื้อหา
   ที่ตั้งใจให้เฉพาะเจ้าหน้าที่อ่าน ไปตอบผู้ใช้ทั่วไปได้ ถ้าไม่ต้องการ ต้องเพิ่มการกรอง
   ตาม visibility ในชั้น vector search ของแชตบอท (แก้ `lib/rag-service.ts` เพิ่ม)

2. **เฟสถัดไปเอา 7 หรือ 8?** เฟส 8 (Dashboard + รายงาน) พึ่งพา "ทุกเฟส" ตามโรดแมป
   ถ้าข้ามไปทำก่อน เฟส 7 ข้อมูลครุภัณฑ์/คำขออนุมัติจะยังไม่มีให้รายงาน
