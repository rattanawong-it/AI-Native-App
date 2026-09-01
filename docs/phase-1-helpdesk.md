# Phase 1 — Helpdesk + Priority & Workflow · สรุปงานที่ทำและข้อตกลง

> **สถานะ:** ✅ เสร็จ 19/21 รายการ (เลื่อนออกตามที่ตกลง 2 รายการ)
> **วันที่:** 1 กันยายน 2569
> **branch:** `feat/itsm-phase-1`
> **อ้างอิง:** `docs/spec.md` §8 ①② · ลำดับการพัฒนา §11 เฟส 1 · มาตรฐาน Git §16

---

## 1. ข้อตกลงที่คุยกันก่อนลงมือ (ขั้นที่ 2 ของ §16.2)

| # | ประเด็น | ข้อสรุป |
|---|---|---|
| 1 | **F1.9 รับแจ้งผ่าน LINE** (แตะ M9 `app/api/line/webhook/route.ts`) | **เลื่อนไป Phase 4** รวมกับงาน Notification ที่ทำ LINE อยู่แล้ว · `stash@{0}` ที่ถอด guard ของ `LINE_CHANNEL_SECRET` **ยังไม่หยิบกลับ** และยังไม่ลบ |
| 2 | **`cookies.txt` ที่ถูก track อยู่** (§16.5 ข้อ 6) | **เก็บกวาดใน branch เฟสนี้** เป็น commit `chore:` แยกก้อนเดียว |
| 3 | **F1.7 ไฟล์แนบ Ticket** | **เลื่อนออก** — รอสรุปว่าจะเก็บไฟล์ที่ไหน (local disk ตาม `UPLOAD_DIR` ต้อง mount volume บน Docker / เก็บลง DB / object storage) |

**ผลจากข้อ 1 และ 3: เฟสนี้ไม่แตะไฟล์ใน M1–M13 เลยแม้แต่ไฟล์เดียว** — เป็นการเพิ่มไฟล์ใหม่ล้วน

---

## 2. ไฟล์เดิมที่แก้

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `.gitignore` | เพิ่ม `/uploads/` (UPLOAD_DIR) และ `cookies.txt` |
| `cookies.txt` | `git rm --cached` — เลิก track (ไฟล์ยังอยู่ในเครื่อง) |
| `docs/spec.md` | ติ๊ก checklist §8 ①② + หมายเหตุ 2 ข้อที่เลื่อนออก |

> **ไม่มีไฟล์ในตาราง M1–M13 ถูกแตะ · ไม่มีการแก้ `schema.prisma` · ไม่มี migration ใหม่**
> Ticket / TicketComment / TicketAttachment / TicketActivity / ServiceCategory / SlaPolicy
> ถูกสร้างครบแล้วตั้งแต่ Phase 0

---

## 3. ไฟล์ใหม่ที่สร้าง (28 ไฟล์)

### Helper libraries (4)

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/ticket-workflow.ts` | Workflow 5 สถานะ + ตารางการเปลี่ยนสถานะที่ถูกต้อง (F2.6) · `canTransition()` `nextStatuses()` `transitionError()` (คืนข้อความไทยอธิบายว่าทำไมเปลี่ยนไม่ได้) · ป้ายไทย + คลาสสีของสถานะ/ช่องทาง/ชนิด activity |
| `lib/ticket-schema.ts` | zod schema ทุก payload (NFR2) — สร้าง/แก้ Ticket, เปลี่ยนสถานะ, มอบหมาย, ความคิดเห็น, query ของหน้ารายการ, Service Catalog · ข้อความ error เป็นภาษาไทยส่งกลับให้ผู้ใช้ได้ตรงๆ |
| `lib/ticket-service.ts` | ตรรกะกลาง — `resolveSlaPolicy()` (นโยบายเฉพาะหมวดมาก่อนนโยบายรวม) · `computeDueDates()` · `resolveAutoAssign()` (ไล่ขึ้นหมวดหลักถ้าหมวดย่อยไม่ได้ตั้งค่า) · `logActivity()` · `buildTicketWhere()` (ผูก row-level scope ไว้ในตัว) · `sortByQueue()` · `syncBreachFlags()` · `computeTicketSla()` |
| `lib/ticket-types.ts` | รูปร่างข้อมูลฝั่ง client + `formatThaiDateTime()` `formatRelative()` `readError()` `slugifyClient()` |

### API routes (10 ไฟล์ · 8 เส้น)

| เส้น | Method | ฟีเจอร์ |
|---|---|---|
| `/api/tickets` | GET · POST | F1.2, F1.3, F1.4, F1.10, F1.11, F2.5, F2.7 |
| `/api/tickets/export` | GET | F1.12 — Excel ด้วย `exceljs` ใช้ฟิลเตอร์ชุดเดียวกับหน้ารายการ (สูงสุด 5,000 แถว) |
| `/api/tickets/[id]` | GET · PATCH | F1.5, F2.4 |
| `/api/tickets/[id]/status` | PATCH | F2.6 + บันทึก `respondedAt` / `resolvedAt` / ธง breach อัตโนมัติ |
| `/api/tickets/[id]/assign` | PATCH | F2.7, F2.8 |
| `/api/tickets/[id]/comments` | GET · POST | F1.6 |
| `/api/categories` | GET · POST | F1.8 |
| `/api/categories/[id]` | PATCH · DELETE | F1.8 — ลบจริงได้เฉพาะหมวดที่ไม่มี Ticket/หมวดย่อยอ้างอยู่ ที่เหลือปิดใช้งานแทน |
| `/api/directory` | GET | รายชื่อเจ้าหน้าที่ / ทีม / ค้นหาผู้ใช้ สำหรับ dropdown |

**ทุกเส้นผ่าน NFR1–NFR3:** `requireAuth()` / `requireRole()` → `zod` validate → กรอง row-level ผ่าน `buildTicketWhere()` + `canAccessTicket()` / `canUpdateTicket()` / `canAssignTicket()`

### หน้าจอ (11 ไฟล์ · 5 หน้า)

| Route | เนื้อหา |
|---|---|
| `service/tickets` | ตาราง + การ์ดสรุป 4 ใบ + ค้นหา (หน่วง 350 ms) + ฟิลเตอร์ 7 ตัว + เรียง 4 แบบ + pagination + ปุ่มส่งออก Excel |
| `service/tickets/new` | ฟอร์มแจ้ง + ปุ่มเลือก Impact × Urgency 3 ขั้น พร้อม **Priority ที่คำนวณสดทันที** + โหมด "บันทึกแทนผู้แจ้ง" (ค้นหาผู้ใช้ + เลือกช่องทาง) |
| `service/tickets/[id]` | รายละเอียด · Timeline · ความคิดเห็น/บันทึกภายใน · แถบ SLA + นับเวลาคงเหลือ · ปุ่มเปลี่ยนสถานะที่ขึ้นตาม workflow · กล่องมอบหมาย · กล่องปรับความสำคัญ · กล่องปิดงาน (บังคับสรุปการแก้ไข + กรอกชั่วโมงได้) |
| `service/tickets/queue` | คิวงานทีมจัดกลุ่มตาม Priority + ภาระงานรายคนเป็นแถบเทียบสัดส่วน (F2.9) |
| `admin/catalog` | Service Catalog 2 ชั้น · เพิ่ม/แก้/ปิดใช้งาน/ลบ · ตั้งทีมและเจ้าหน้าที่เริ่มต้นที่ใช้ auto-assign |

### ชิ้นส่วน UI (1)

`components/ticket/ticket-badges.tsx` — `PriorityBadge` `StatusBadge` `SlaIndicator` `SlaProgressBar` `PersonChip` `ImpactUrgencyText` · **สีทุกตัวอ่านจาก design token ใน `app/globals.css` ที่วางไว้ตั้งแต่ Phase 0** ไม่มีสี hardcode

### Layout (1)

`app/(main)/service/layout.tsx` — วาง `<Toaster />` ไว้เฉพาะกลุ่มหน้า service **จึงไม่ต้องแตะ `app/(main)/layout.tsx` เดิม**

---

## 4. การตัดสินใจเชิงออกแบบที่ควรรู้

| # | เรื่อง | ที่ทำและเหตุผล |
|---|---|---|
| 1 | **เรียงคิวงานตาม Priority** | `priority` เก็บเป็น `String` ใน schema จึง `ORDER BY` ให้ได้ลำดับที่ถูกต้องไม่ได้ — SQL เรียงตาม `resolutionDueAt` ก่อน แล้วเรียง Priority ต่อในหน่วยความจำด้วย `sortByQueue()` **ข้อจำกัด: เรียงถูกเฉพาะภายในหน้าที่แสดงอยู่** ถ้าข้อมูลโตมากควรเปลี่ยนเป็น enum หรือคอลัมน์น้ำหนักตัวเลข |
| 2 | **ธง breach** | คำนวณตอนอ่านรายการ (`syncBreachFlags`) ไม่ได้ใช้ cron — ตรงกับ spec §8 ④ ที่ตัด auto-escalation ออกแล้ว |
| 3 | **หน้าคิวงานทีมไม่ได้เพิ่มในเมนู** | เข้าจากปุ่ม "คิวงานทีม" บนหน้า Ticket ทั้งหมด เพื่อไม่ต้องแตะ `sidebar-data.ts` (M5) — ถ้าต้องการให้อยู่ในเมนูซ้ายด้วย ต้องขออนุมัติแก้ M5 |
| 4 | **ทางเปลี่ยนสถานะเพิ่มจาก spec** | spec ระบุเส้นทางไปข้างหน้า 4 เส้น เพิ่มเส้นทางถอยที่จำเป็นหน้างาน: `assigned → new` (ถอนมอบหมาย) · `in_progress → assigned` (ส่งคืนคิว) · `resolved → in_progress` (เปิดงานอีกครั้ง) · `closed` เป็นสถานะปลายทางเปลี่ยนต่อไม่ได้ |
| 5 | **Time Log ตอนปิดงาน** | ช่องกรอกชั่วโมงมีแล้วและบันทึกลง `WorkLog` จริง แต่**ยังไม่บังคับ** — `AppSetting.ticket.require_worklog_on_resolve = true` จะเริ่มบังคับใน Phase 3 (F3.6) พร้อมหน้า My Work |
| 6 | **เวลาตอบกลับครั้งแรก (`respondedAt`)** | บันทึกทั้งตอนเจ้าหน้าที่เปลี่ยนสถานะเป็น `in_progress` และตอนเจ้าหน้าที่แสดงความคิดเห็นสาธารณะครั้งแรก (บันทึกภายในไม่นับ) |
| 7 | **ผู้แจ้งแก้ Ticket ได้แค่ไหน** | แก้หัวข้อ/รายละเอียดได้เฉพาะตอนสถานะยัง `new` · ปรับ Impact/Urgency ไม่ได้ · หลังเจ้าหน้าที่รับงานให้แจ้งเพิ่มผ่านความคิดเห็นแทน |
| 8 | **agent มอบหมายงาน** | รับงานที่ยังไม่มีเจ้าของได้เอง และโยกใบที่ตัวเองถืออยู่ได้ · **ยกงานให้คนอื่นเป็นสิทธิ์ของ manager ขึ้นไป** ตาม spec §7 |

---

## 5. ผลการตรวจสอบ (เกต G1–G7)

| เกต | คำสั่ง | ผล |
|---|---|---|
| G1 | `git status --porcelain` | ✅ ไม่มีไฟล์แปลกปลอม |
| G2 | *(ไม่แตะ `schema.prisma`)* | — ไม่เข้าเงื่อนไข |
| G3 | *(ไม่แตะ `schema.prisma`)* | — ไม่เข้าเงื่อนไข |
| G4 | `npx tsc --noEmit` | ✅ **0 error** |
| G5 | `pnpm lint <ไฟล์ที่สร้างใหม่>` | ✅ **0 error 0 warning** (baseline เดิม 18 error ในไฟล์ "ไม่แตะเลย" ยังคงเดิม) |
| G6 | `pnpm build` | ✅ ผ่าน — compiled in 22.0s · route ใหม่ขึ้นครบ 15 เส้น |
| G7 | ทบทวน diff | ✅ ไม่มีไฟล์นอกขอบเขตที่ตกลงไว้ |

### ทดสอบตรรกะกับข้อมูลจริงใน Neon (อ่านอย่างเดียว — ไม่เขียนแม้แถวเดียว)

| หัวข้อ | ผล |
|---|---|
| Priority Matrix 9 ช่อง | ✅ ตรงตาราง spec §5.2 ทุกช่อง |
| Workflow validation | ✅ `new→resolved` ถูกปฏิเสธพร้อมข้อความไทยอธิบายเส้นทางที่ถูกต้อง · `closed` ไม่มีทางออก |
| SLA Policy จาก DB | ✅ critical 30/240 · high 60/480 · medium 240/1440 · low 480/3360 (นาทีทำการ) |
| คำนวณเวลาทำการ | ✅ แจ้งอังคาร 1 ก.ย. 09:00 → critical แก้ไขภายใน 13:00 วันเดียวกัน · medium → ศุกร์ 4 ก.ย. 09:00 (3 วันทำการ) · low → พฤหัส 10 ก.ย. 09:00 (7 วันทำการ) — ข้ามเสาร์-อาทิตย์ถูกต้อง |
| Auto-assign | ✅ หมวด "เว็บไซต์มหาวิทยาลัย / คณะ" → ทีมพัฒนาระบบสารสนเทศ (ยังไม่มี `defaultAssigneeId` เพราะยังไม่มีรายชื่อเจ้าหน้าที่จริง) |
| เลขที่รันนิ่ง | ✅ `TK-256909-00001` |
| ข้อมูล master | ✅ ServiceCategory 17 · SlaPolicy 4 · BusinessHour 7 · Holiday 19 |

---

## 6. ค้างไว้ / ต้องทำต่อ

1. **F1.7 ไฟล์แนบ Ticket** — เลื่อนออก **ต้องตัดสินใจก่อนว่าจะเก็บไฟล์ที่ไหน** (local disk + Docker volume / DB bytea / object storage) ตาราง `TicketAttachment` และ env `UPLOAD_DIR` `MAX_UPLOAD_SIZE` พร้อมอยู่แล้ว · ฟอร์มแจ้งปัญหาแสดงหมายเหตุบอกผู้ใช้ไว้แล้ว
2. **F1.9 รับแจ้งผ่าน LINE** — เลื่อนไป Phase 4 · `stash@{0}` ที่ค้างอยู่ (ถอด guard `LINE_CHANNEL_SECRET` + การตรวจ signature) **ยังไม่ตัดสินใจว่าจะทิ้งหรือหยิบกลับ** — ควรทิ้ง เพราะเป็นการถอยด้านความปลอดภัย
3. **ยังไม่ได้ทดสอบเขียนข้อมูลจริง** — ยังไม่มีการสร้าง Ticket ทดสอบลง Neon เพราะเป็น DB ที่ใช้งานจริง **ต้องรันเทสต์ end-to-end ผ่านหน้าเว็บด้วยบัญชีจริงก่อนถือว่าใช้งานได้เต็มที่**
4. **ยังไม่มีเจ้าหน้าที่จริงในระบบ** — `ServiceCategory.defaultAssigneeId` ยังว่างทุกหมวด auto-assign จึงได้แค่ทีม ไม่ได้ตัวบุคคล · เมื่อได้รายชื่อแล้วให้ตั้งค่าที่หน้า `admin/catalog` (spec §14 ข้อ 6)
5. **หน้า `admin/sla` และ `admin/calendar` ยังไม่มี** — อยู่ใน Phase 2 (F4.1–F4.3) · ปัจจุบันแก้ SLA/วันหยุดได้ผ่าน seed เท่านั้น
6. **เมนู "คิวงานทีม" ยังไม่อยู่ใน sidebar** — เข้าจากปุ่มบนหน้า Ticket ทั้งหมด (ดู §4 ข้อ 3)
7. **`pnpm lint` ทั้งโปรเจกต์ยังมี 18 error เดิม** — ค้างมาตั้งแต่ก่อน Phase 0 ทั้งหมดเป็น `no-explicit-any` ในไฟล์กลุ่ม "ไม่แตะเลย" ยังไม่ได้แก้ตามข้อตกลงเดิม
8. **โลโก้/ชื่อแอปใน sidebar** ยังเป็น "AI Native" ตามที่ค้างจาก Phase 0 ข้อ 4

---

## 7. commit ในเฟสนี้

| commit | เรื่อง |
|---|---|
| `476a9d0` | `chore(git)` เลิก track `cookies.txt` + กันไฟล์อัปโหลดออกจาก repo |
| `ec3ccbb` | `feat(tickets)` ชั้น API — CRUD, workflow, มอบหมาย, ส่งออก Excel (12 ไฟล์) |
| `adf101f` | `feat(tickets)` หน้าจอ Helpdesk 5 หน้า + ชิ้นส่วน UI (13 ไฟล์) |
| *(commit นี้)* | `docs` ติ๊ก checklist §8 ①② + เอกสารปิดเฟส |

*(`cd8596d` docs §16 มาตรฐาน Git ทำไว้ก่อนเปิดเฟส และจะไป `main` พร้อมกันตอน merge)*
