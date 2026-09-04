# Phase 0 — Foundation · สรุปงานที่ทำและข้อตกลง

> **สถานะ:** ✅ เสร็จครบ 13/13 รายการ
> **วันที่:** 31 สิงหาคม 2569
> **อ้างอิง:** `docs/spec.md` §8 Phase 0 · UI จาก `project-ui/design-system-setup-request/`

---

## 1. ข้อตกลงที่คุยกันก่อนลงมือ

| # | ประเด็น | ข้อสรุป |
|---|---|---|
| 1 | `app/globals.css` (อยู่นอกตาราง M1–M13) | **อนุมัติให้แก้** — เปลี่ยนสีแบรนด์เป็น OIT navy `#13215E` + gold `#E8A400` ตาม design system พร้อมเพิ่ม token ของ priority / status / SLA ครบทั้ง light และ dark |
| 2 | Migration กับ DB จริง (Neon) | รอบแรกตกลงว่า "ยังไม่รัน" → **ภายหลังอนุมัติให้รัน** และ apply สำเร็จแล้ว (ดู §9) |
| 3 | คำถามค้าง 6 ข้อใน spec §14 | **ใช้ค่าเริ่มต้นตาม spec ไปก่อน** — Catalog / SLA / เวลาทำการ / วันหยุด seed ตามเอกสาร ปรับได้ในหน้า admin ภายหลัง |
| 4 | ติดตั้ง shadcn 19 ตัว | **รัน shadcn CLI** — ได้ไฟล์ตรง style `radix-vega` ของ `components.json` เดิม |
| 5 | ชื่อเมนูเดิมเป็นภาษาอังกฤษ | **อนุมัติให้แปลเป็นไทย** ตาม NFR4 และไฟล์ดีไซน์ |
| 6 | ESLint ไล่ตรวจไฟล์ prototype | **อนุมัติให้ ignore** `project-ui/**` (และ `app/generated/**`) |

---

## 2. ไฟล์เดิมที่แก้ (ทั้งหมดแจ้งไว้ล่วงหน้าแล้ว)

| ไฟล์ | รหัส | สิ่งที่เปลี่ยน |
|---|---|---|
| `prisma/schema.prisma` | M1, M2 | เพิ่ม **28 models ใหม่** (จาก 11 → 39) + เพิ่ม 6 field ใน `User` (`departmentId`, `position`, `phone`, `employeeCode`, `lineUserId`, `isAgent` — nullable ทั้งหมด) + relation ของ ITSM · **ไม่แตะ 10 models เดิม** |
| `lib/permissions.ts` | M3 | เพิ่ม 7 statement (`ticket`, `task`, `kb`, `asset`, `approval`, `report`, `sla`) + role ใหม่ `student`, `agent` · คง statement `project` เดิมไว้ |
| `lib/auth.ts` | M4 | แตะเฉพาะ 2 บรรทัด — import role ใหม่ + ลงทะเบียนใน `adminPlugin({ ac, roles })` |
| `_components/sidebar/sidebar-data.ts` | M5 | เพิ่ม 4 section ใหม่ + `allowedRoles` ระดับเมนูย่อย + `filterSectionsByRole()` + **แปลชื่อเมนูเดิมทั้งหมดเป็นไทย** (href เดิมไม่เปลี่ยน) |
| `_components/sidebar/sidebar.tsx` | *(เพิ่มจาก M5)* | เปลี่ยนการกรอง 1 บรรทัด ให้เรียก `filterSectionsByRole()` |
| `app/globals.css` | *(นอก M — ขออนุมัติแล้ว)* | สีแบรนด์ + ITSM design token |
| `eslint.config.mjs` | *(นอก M — ขออนุมัติแล้ว)* | เพิ่ม `project-ui/**` และ `app/generated/**` เข้า globalIgnores |
| `package.json` | M11 | เพิ่ม 13 dependencies |
| `.env` / `.env.production` | M13 | เพิ่ม 7 env ใหม่ (ต่อท้าย ไม่แก้ค่าเดิม) |
| `prisma/seed.ts` | F0.12 | คงตรรกะตั้ง admin เดิมไว้ทั้งหมด + เพิ่ม seed master data 7 ชุด |
| `components/ui/button.tsx` | M12 | shadcn CLI อัปเดตเป็นเวอร์ชันล่าสุดของ registry (เปลี่ยน 3 คลาส · API เหมือนเดิม) |

---

## 3. ไฟล์ใหม่ที่สร้าง

### Helper libraries

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/rbac.ts` | `requireAuth()` / `requireRole()` / `requireMinRole()` · `canAccessTicket()` `canUpdateTicket()` `canAssignTicket()` · `ticketScopeWhere()` สำหรับ row-level filter (NFR3) · helper ตอบ 401/403/404/400 |
| `lib/priority.ts` | Matrix 3×3 `calculatePriority(impact, urgency)` → critical/high/medium/low · `compareByQueueOrder()` เรียงคิวงาน · ป้ายไทย + คลาสสี badge |
| `lib/business-hours.ts` | `addBusinessMinutes()` `businessMinutesBetween()` `calculateDueDates()` `getSlaProgress()` — คำนวณบนเวลาไทย UTC+7 ข้ามนอกเวลาทำการ/เสาร์-อาทิตย์/วันหยุด · โหลดปฏิทินจาก DB แล้ว cache 5 นาที |
| `lib/running-number.ts` | `nextTicketNo()` → `TK-256908-00001` · `nextRequestNo()` → `RQ-256908-0001` · `createWithRunningNumber()` ลองใหม่อัตโนมัติเมื่อเลขชนกัน · `slugify()` สำหรับ KB |

### shadcn/ui (19 ตัว)

`table` `dialog` `select` `badge` `tabs` `textarea` `dropdown-menu` `avatar` `separator` `sheet` `popover` `calendar` `checkbox` `switch` `sonner` `skeleton` `alert-dialog` `progress` `tooltip`

### Migration

| โฟลเดอร์ | ที่มา |
|---|---|
| `prisma/migrations/20260609112407_add_document_table/` | **กู้คืน** — ไฟล์หายจาก repo แต่ถูก apply ลง DB แล้ว (ดู §9) |
| `prisma/migrations/20260831120000_itsm_phase0/` | ITSM ทั้งหมด — 28 CREATE TABLE, 47 FK, 32 index, 15 unique index, 1 ALTER TABLE (6 คอลัมน์ใน `user`) |

---

## 4. Design token ที่เพิ่มใน `globals.css`

ถอดค่ามาจาก `IT Service Design System.dc.html` โดยตรง ใช้เป็นคลาส Tailwind ได้ทันที เช่น `bg-priority-critical-bg text-priority-critical-fg`

| กลุ่ม | Token |
|---|---|
| แบรนด์ | `--brand #13215E` · `--brand-dark #0A1440` · `--brand-tint #EEF1FA` · `--gold #E8A400` (+ `-bg` `-fg`) |
| Priority | `priority-critical` `priority-high` `priority-medium` `priority-low` × (สีจุด / `-bg` / `-fg`) |
| Ticket Status | `status-new` `status-assigned` `status-progress` `status-resolved` `status-closed` × (สีจุด / `-bg` / `-fg`) |
| SLA | `sla-ontime` 🟢 · `sla-atrisk` 🟡 · `sla-breached` 🔴 |

`--primary` เปลี่ยนจากดำ → navy · dark mode ใช้ navy สว่าง `#8B9BE8` บนพื้น `#171717` / การ์ด `#212121` ตาม design system

---

## 5. Data Model — 28 models ใหม่

| กลุ่ม | Models |
|---|---|
| Master Data | `Department` `ServiceCategory` `SlaPolicy` `BusinessHour` `Holiday` `AppSetting` |
| Helpdesk | `Ticket` `TicketComment` `TicketAttachment` `TicketActivity` |
| My Work | `TodoItem` `WorkLog` |
| SDLC | `Project` `Sprint` `Task` `TaskComment` `Team` `TeamMember` |
| Knowledge Base | `KbArticle` `KbFeedback` |
| งานธุรการ | `Asset` `AssetHistory` `ApprovalRequest` `ApprovalStep` `ApprovalAttachment` `ReportSnapshot` |
| Notification | `Notification` `NotificationDelivery` |

Index ตาม NFR8 ครบ: `Ticket(status, priority, assigneeId, createdAt)` · `Task(projectId, boardStatus)` · `WorkLog(userId, workDate)`

**ลิงก์สองทาง Ticket ↔ Task (F5.8):** `Ticket.convertedTaskId` (unique) และ `Task.sourceTicketId`

---

## 6. เมนูใน Sidebar (หลังแปลเป็นไทยครบ)

| Section | เมนู | เห็นได้โดย |
|---|---|---|
| *(ไม่มีหัวข้อ)* | แดชบอร์ด | ทุก role |
| **งานบริการ** | Ticket ทั้งหมด | ทุก role |
| | My Work | `agent` `manager` `admin` |
| **ฐานความรู้** | Knowledge Base | ทุก role |
| AI & ข้อมูล | แชท AI | ทุก role |
| **งานธุรการศูนย์** | ครุภัณฑ์ IT · คำขออนุมัติ · รายงาน | `agent` `manager` `admin` |
| บริหารจัดการ | โครงการพัฒนา · ทีมงาน · ผู้สนใจ (Lead) | `manager` `admin` |
| **ตั้งค่าบริการ** | Service Catalog · SLA Policy · ปฏิทินทำการ | `admin` |
| ผู้ดูแลระบบ | ผู้ใช้งาน · คลังเอกสาร RAG · กลุ่ม LINE · ตั้งค่าระบบ | `admin` |
| *(bottom)* | ช่วยเหลือ | ทุก role |

> `header.tsx` ดึงชื่อหน้าจาก `sidebarData` อยู่แล้ว หัวข้อบน AppBar จึงเปลี่ยนเป็นไทยตามไปด้วยโดยไม่ต้องแก้ไฟล์
>
> _อัปเดต (fix/sidebar-remove-new-ticket-menu):_ ตัดเมนู "แจ้งปัญหาใหม่" ออกจาก sidebar เพราะซ้ำกับปุ่ม "+ แจ้งปัญหาใหม่" มุมขวาบนหน้า Ticket ทั้งหมด · route `/service/tickets/new` ยังอยู่ครบ · เพิ่ม `/service/tickets/new` ลง `pageTitles` ใน `header.tsx` ให้หัวข้อ AppBar ยังเป็น "แจ้งปัญหาใหม่" (ไม่งั้นจะตกไป match pattern `/service/tickets/[id]` กลายเป็น "รายละเอียด Ticket")

---

## 7. Master Data ที่ seed ลง DB จริงแล้ว

| ชุด | จำนวน | หมายเหตุ |
|---|---|---|
| Department | 1 | เฉพาะศูนย์ไอที — รอรายชื่อหน่วยงานจริง (spec §14 ข้อ 3) |
| Team | 3 | ทีมพัฒนาระบบ / ทีมเครือข่าย & บัญชีผู้ใช้ / ทีมธุรการศูนย์ — รอรายชื่อเจ้าหน้าที่จริง (§14 ข้อ 6) |
| Service Catalog | 17 (3 หมวดหลัก + 14 หมวดย่อย) | ผูก `defaultTeamId` ไว้แล้วเพื่อรองรับ auto-assign |
| SLA Policy | 4 ระดับ | Critical 30 น./4 ชม. · High 60 น./1 วัน · Medium 4 ชม./3 วัน · Low 1 วัน/7 วัน *(นาทีทำการ)* |
| Business Hour | 7 แถว | จ.–ศ. 08:30–16:30 · ส.-อา. หยุด |
| Holiday | 19 (15 วันตายตัว + 4 วันจันทรคติ) | วันตายตัวตั้ง `isRecurring = true` ใช้ซ้ำทุกปี · **วันจันทรคติเป็นของ พ.ศ. 2569 ต้องตรวจสอบ/ปรับทุกปีในหน้า `admin/calendar`** |
| AppSetting | 6 คีย์ | auto-assign, บังคับ Time Log, ช่องทางแจ้งเตือน, เกณฑ์ at-risk 75%, ชนิดไฟล์แนบ |

---

## 8. ผลการตรวจสอบ

| รายการ | ผล |
|---|---|
| `prisma validate` | ✅ ผ่าน |
| `prisma generate` | ✅ ผ่าน (39 models) |
| `prisma migrate deploy` | ✅ apply `20260831120000_itsm_phase0` สำเร็จ |
| `prisma migrate status` | ✅ 4 migrations · Database schema is up to date |
| Seed | ✅ ครบทั้ง 7 ชุด |
| `tsc --noEmit` | ✅ ไม่มี error |
| `next build` | ✅ ผ่าน |
| `eslint` ไฟล์ที่แก้/สร้างใหม่ | ✅ ไม่มี error |

**ข้อมูลเดิมก่อน/หลัง migration — ครบเท่าเดิมทุกตาราง**

| ตาราง | ก่อน | หลัง |
|---|---|---|
| `user` | 3 | 3 |
| `document` (pgvector) | 18 | 18 |
| `chat_message` | 16 | 16 |
| `chat_session` | 3 | 3 |
| `lead` | 5 | 5 |
| `line_group` | 2 | 2 |
| `knowledge_document` | 1 | 1 |

---

## 9. ⚠️ เหตุการณ์ระหว่างรัน Migration — drift และวิธีซ่อม

**อาการ:** `prisma migrate dev` ตอบว่า
> Drift detected… We need to reset the "public" schema… **All data will be lost.**

**สาเหตุ:** migration `20260609112407_add_document_table` ถูก apply ลง DB ไปแล้ว (มีบันทึกใน `_prisma_migrations`) แต่ **โฟลเดอร์ของมันหายไปจาก `prisma/migrations/`** Prisma จึงเทียบแล้วพบว่า DB มีตาราง `document`, `chat_session`, `chat_message`, `knowledge_document`, `lead`, `line_group` และ extension `vector` เกินมาจาก history ที่มีในเครื่อง

**สิ่งที่ทำ (ไม่แตะข้อมูลแม้แถวเดียว — ไม่ได้รัน `migrate reset`):**

1. ตรวจปริมาณข้อมูลใน DB ก่อน เพื่อยืนยันว่ามีของจริงและห้าม reset
2. ถอด DDL ของ DB ปัจจุบันด้วย `prisma migrate diff --from-empty --to-config-datasource --script`
3. **สร้างโฟลเดอร์ `20260609112407_add_document_table/migration.sql` กลับคืน** จาก DDL ที่ถอดได้ → history ตรงกับ DB
4. อัปเดตคอลัมน์ `checksum` ของ migration นั้นใน `_prisma_migrations` ให้ตรงกับ SHA-256 ของไฟล์ที่สร้างใหม่ (แก้ error `migration was modified after it was applied`)
5. สร้าง SQL ของ Phase 0 ด้วย `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` แล้ว **ตรวจว่าไม่มี `DROP` / `TRUNCATE` เลย** (additive ล้วน)
6. apply ด้วย `prisma migrate deploy` (non-interactive จึงไม่ติด prompt ยืนยัน unique `lineUserId`)
7. รัน seed แล้วนับข้อมูลเดิมซ้ำ → ครบเท่าเดิมทุกตาราง

**สิ่งที่ต้องระวังต่อไป:** โฟลเดอร์ใน `prisma/migrations/` ต้อง commit เข้า git ทุกครั้ง ถ้าหายอีกจะเจอปัญหาเดิม

---

## 10. ค้างไว้ / ต้องทำต่อ

1. **เมนูใหม่ยังไม่มีหน้ารองรับ** — `/service/*`, `/management/assets|requests|reports`, `/admin/catalog|sla|calendar` จะถูกสร้างใน Phase 1–8 ตามลำดับใน spec §11 (Phase 1 จะเติม `/service/tickets` เป็นชุดแรก)
2. **Dependency สำหรับ Export PDF** (`@react-pdf/renderer` / `puppeteer`) เลื่อนไปติดตั้งตอน Phase 8 ที่ใช้งานจริง
3. **`pnpm lint` ยังมี 18 error ค้างจากก่อน Phase 0** — ทั้งหมดเป็น `no-explicit-any` ใน `app/api/**`, `components/chat/ChatWindow.tsx`, `lib/ingestion.ts`, `lib/vector-search.ts`, `scripts/ingest.ts` · **ไม่ได้แก้เพราะ spec §4 ระบุว่าเป็นไฟล์ที่ "ไม่แตะเลย"** — ถ้าต้องการให้เก็บกวาด ต้องอนุมัติเป็นงานแยก
4. **โลโก้/ชื่อแอปใน sidebar** ยังเป็น "AI Native" + ไอคอน Sparkles สีม่วง-คราม ขณะที่ไฟล์ดีไซน์ใช้ "OIT Service" + gradient navy — **ยังไม่ได้แก้ รอการอนุมัติ**
