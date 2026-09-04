# ผู้รับผิดชอบหลายคน + Auto-assign ตามภาระงานน้อยที่สุด

> ปิดงาน 4 กันยายน 2569 · branch `feat/itsm-catalog-multi-assignee` · อ้างอิง spec ข้อ 19 (§3), §5.1, F2.10–F2.12
> งานฟีเจอร์แทรกนอกเฟส — แตกจาก `main` ตรง ไม่ปนกับแผน Phase 10 ที่ยังรออนุมัติ

---

## 1. ขอบเขต

| ฟีเจอร์ | สถานะ |
|---|---|
| F2.10 model `ServiceCategoryAssignee` + migration ย้ายข้อมูลเดิม | ✅ |
| F2.11 `resolveAutoAssign()` เลือกคนที่ภาระงานน้อยที่สุด | ✅ |
| F2.12 หน้า `admin/catalog` เลือกผู้รับผิดชอบได้หลายคน | ✅ |
| F2.8 reassign ด้วยมือ | ⛔ **ไม่แตะตามข้อกำหนด** — หัวหน้ายังโยกงานได้อิสระเหมือนเดิม |

### ข้อตกลงที่ผู้ใช้เลือกก่อนเริ่ม

| ประเด็น | ที่เลือก |
|---|---|
| นิยาม "ภาระงาน" | จำนวน `Ticket` ที่ `status ∈ (assigned, in_progress)` — ไม่รวม `Task` และไม่ใช้ชั่วโมงจาก `WorkLog` |
| Tie-breaker | คนที่ได้ Ticket ในหมวดนั้นล่าสุด **นานที่สุด** (round-robin) |
| ข้อมูล `defaultAssigneeId` เดิม | คัดลอกเข้าตารางใหม่ + **คง field เดิมไว้** เป็น deprecated |
| Branch | `feat/itsm-catalog-multi-assignee` แตกจาก `main` |

---

## 2. การขออนุมัติ (§16.2 ขั้น 2)

แจ้งรายการไฟล์ก่อนลงมือและได้รับอนุมัติครบทั้ง 11 ไฟล์

| กลุ่ม | ไฟล์ |
|---|---|
| ในตาราง M1–M13 | **M1** `prisma/schema.prisma` |
| ไฟล์ใหม่ | `prisma/migrations/20260904160000_category_multi_assignee/` · `docs/catalog-multi-assignee.md` |
| นอกตาราง (ขออนุมัติรายกรณี) | `lib/ticket-service.ts` · `lib/ticket-schema.ts` · `lib/ticket-types.ts` · `app/api/categories/route.ts` · `app/api/categories/[id]/route.ts` · `app/api/directory/route.ts` · `app/api/tickets/route.ts` · `lib/line-ticket.ts` · `app/(main)/admin/catalog/CatalogContent.tsx` |

**ไม่แตะ:** `app/api/tickets/[id]/assign` (reassign) · `prisma/seed.ts` · `lib/rbac.ts` · ไฟล์กลุ่ม "ไม่แตะเลย" ทั้งหมด

---

## 3. สิ่งที่ทำ

### 3.1 Data model (F2.10)

```prisma
model ServiceCategoryAssignee {
  id         String   @id @default(cuid())
  categoryId String
  userId     String
  createdAt  DateTime @default(now())

  category ServiceCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([categoryId, userId])
  @@index([categoryId])
  @@index([userId])
  @@map("service_category_assignee")
}
```

- `ServiceCategory.defaultAssigneeId` **ยังอยู่** แต่เป็น deprecated — ระบบซิงก์ให้ชี้คนแรกในรายชื่อเสมอ
  เพื่อไม่ให้ค่าเก่าค้างแล้วย้อนมาเป็น "ผู้รับผิดชอบเงา" ตอนที่ admin ล้างรายชื่อออกจนหมด
- migration ใช้ `INSERT ... SELECT` ย้ายข้อมูลเดิม **ไม่มี `DROP` / `TRUNCATE`** (ตรวจด้วย `grep -Ei 'drop|truncate'` ก่อน apply ตาม §16.5 ข้อ 3) และ apply ด้วย `prisma migrate deploy`

### 3.2 Auto-assign engine (F2.11) — `lib/ticket-service.ts`

ลำดับการตัดสินของ `resolveAutoAssign(categoryId)`

1. ปิดสวิตช์ที่ `AppSetting "ticket.auto_assign"` ได้เหมือนเดิม → คืนค่าว่างทันที
2. อ่านผู้รับผิดชอบจาก `ServiceCategoryAssignee` — หมวดย่อยที่ไม่มีทั้งคนและทีม ไต่ขึ้นไปใช้ของหมวดหลัก
3. คัดเฉพาะคนที่รับงานได้จริง — เป็นเจ้าหน้าที่ (`role` มี `agent`/`manager`/`admin` หรือ `isAgent`) และไม่ถูกระงับบัญชี (`ASSIGNABLE_USER_WHERE`)
4. **ภาระงาน** = `Ticket` ที่ถืออยู่ (`assigned` + `in_progress`) **นับข้ามทุกหมวดหมู่** เพราะภาระงานเป็นของคน ไม่ใช่ของหมวด
5. เท่ากัน → คนที่ได้ Ticket ในขอบเขตหมวดนั้นล่าสุดนานที่สุด → `createdAt` ของการผูก → `userId` (deterministic)
6. Fallback เดิมครบ: 1 คน → `defaultTeamId` → ปล่อยว่างรอ manual assign
7. คืน `reason` กลับไปบันทึกใน `TicketActivity` ทั้งฝั่งเว็บ (`POST /api/tickets`) และ LINE (`lib/line-ticket.ts`)

> **ขอบเขตของ tie-breaker** = หมวดต้นทางที่ให้รายชื่อมา + หมวดย่อยที่สืบทอดรายชื่อนั้น
> เพื่อไม่ให้แต่ละหมวดย่อยหมุนคิวแยกกันจนตกไปที่คนแรกซ้ำ ๆ

### 3.3 API

| Endpoint | เปลี่ยนอะไร |
|---|---|
| `POST /api/categories` | รับ `assigneeIds: string[]` · validate ว่าทุกคนรับงานได้จริง · เขียนหมวด + รายชื่อใน transaction เดียว |
| `PATCH /api/categories/[id]` | ส่ง `assigneeIds` มาเมื่อใด = แทนที่รายชื่อทั้งชุด (ลบที่เกิน เพิ่มที่ขาด) · ยังรับ `defaultAssigneeId` เดิมของ client เก่าได้ |
| `GET /api/directory?scope=agents` | เพิ่ม `openTickets` ต่อคน + ใช้เงื่อนไขคัดคนชุดเดียวกับ auto-assign เพื่อให้รายชื่อบนจอตรงกับคนที่ระบบมอบงานให้จริง |

### 3.4 UI (F2.12) — `admin/catalog`

- ช่อง "เจ้าหน้าที่เริ่มต้น" เดิม (select เดี่ยว) → **รายการติ๊กเลือกหลายคน** พร้อมป้าย "ถืออยู่ N งาน" ต่อคน
- อธิบายกติกาใต้หัวข้อ + บอกจำนวนที่เลือก และเตือนเมื่อไม่เลือกเลยว่าจะตกไปที่ทีม
- รายการหมวดหลัก/หมวดย่อยแสดงผู้รับผิดชอบหลายคน (เกิน 2 คนย่อเป็น `+N`)

---

## 4. ผลตรวจ

### เกต §16.4

| เกต | ผล |
|---|---|
| G1 ไฟล์ที่ commit | ✅ ไม่มีไฟล์แปลกปลอม — สคริปต์ทดสอบเก็บใน scratchpad นอก repo |
| G2 `prisma validate` | ✅ ผ่าน |
| G3 `prisma generate` | ✅ ผ่าน |
| G4 `tsc --noEmit` | ✅ 0 error |
| G5 `eslint` ไฟล์ที่แก้ | ✅ 0 error |
| G6 `pnpm build` | ✅ Compiled successfully |
| G7 ขอบเขต | ✅ ทุกไฟล์อยู่ในรายการที่อนุมัติแล้ว |

### ทดสอบพฤติกรรมบนข้อมูลจริง (สร้างข้อมูลทดสอบแล้วลบทิ้งทุกครั้ง — ตรวจแล้วไม่เหลือค้าง)

| กรณี | ผล |
|---|---|
| migration backfill | 8 แถวเข้าตารางใหม่ครบ · `defaultAssigneeId` เดิมยังอยู่ครบ 8 · หมวดทั้งหมดยัง 25 |
| หมวดที่ backfill มา (1 คน) | ได้คนเดิมทุกหมวด ✅ |
| หมวดที่ไม่มีผู้รับผิดชอบ | ตกไปที่ `defaultTeamId` ✅ |
| หมวด 3 คน (ภาระ 1/0/0) | เลือกคนที่ 0 งาน ✅ |
| ปิด `ticket.auto_assign` | ไม่มอบหมายเลย ✅ (คืนค่าเดิมหลังทดสอบ) |
| ยิง 4 Ticket เข้าหมวดเดียวกัน | กระจาย 2/1/1 · ส่วนต่างภาระงานสุดท้าย = 1 · ไม่มีใครได้เกิน 2 ใบ ✅ |
| `findUnassignableUsers` | คัด id ที่ไม่ใช่เจ้าหน้าที่ออกได้ ✅ |
| `syncCategoryAssignees` | ผูก 3 คน + ซิงก์ `defaultAssigneeId` เป็นคนแรก ✅ |

> เลขรันนิ่ง `TK-YYYYMM-#####` คำนวณจากเลขสูงสุดที่มีอยู่ จึงไม่เหลือช่องว่างหลังลบ Ticket ทดสอบ (ตรวจแล้วเลขถัดไปยังต่อเนื่อง)

---

## 5. ของค้าง / ข้อควรรู้

1. **ยังไม่มีใครถูกตั้งเป็นผู้รับผิดชอบหลายคนจริง** — ข้อมูลที่ backfill มาเป็น 1 คนต่อหมวดทั้ง 8 หมวด
   ประโยชน์ของฟีเจอร์จะเห็นเมื่อ admin เข้าไปเพิ่มคนที่หน้า `admin/catalog`
2. **17 หมวดที่ไม่มีผู้รับผิดชอบเลย** ยังตกไปที่ทีมเหมือนเดิม (`status = new`, `assigneeId = null`) — ถ้าต้องการให้ auto-assign ทำงานครบทุกหมวด ต้องตั้งผู้รับผิดชอบเพิ่ม
3. **ไม่มีใครตั้ง `isAgent = true`** — ตัวกรองอาศัย `role` ซึ่งครอบคลุม 7 จาก 9 คนใน DB จริง
4. คำถามค้างที่เพิ่มไว้ใน spec §14 ข้อ 7–9: เพดานงานต่อคน · ถ่วงน้ำหนักตาม priority · สถานะ "ลาหยุด/ไม่พร้อมรับงาน"
   ทั้งสามข้อแก้ได้ที่ `resolveAutoAssign()` จุดเดียว
5. `defaultAssigneeId` ยังไม่ถูกลบ — ถ้าใช้งานนิ่งแล้วค่อยเปิดงานแยกเพื่อ drop column พร้อมตรวจ SQL ตาม §16.5

---

## 6. Commit ของงานนี้

| Commit | เรื่อง |
|---|---|
| `docs(itsm): เพิ่มข้อ 19 …` | อัปเดต spec ก่อนแตะโค้ด (§3, §5.1, §8, §14) |
| `feat(schema): เพิ่ม ServiceCategoryAssignee …` | schema + migration + backfill (F2.10) |
| `feat(itsm): auto-assign เลือกผู้รับผิดชอบที่ภาระงานน้อยที่สุด` | engine + API (F2.11) |
| `feat(itsm): เลือกผู้รับผิดชอบเริ่มต้นได้หลายคน …` | UI หน้า Catalog (F2.12) |
| `docs(itsm): สรุปงานผู้รับผิดชอบหลายคน …` | เอกสารฉบับนี้ + ติ๊ก checklist |
