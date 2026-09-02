# Phase 7 — งานธุรการศูนย์: ทะเบียนครุภัณฑ์ + คำขออนุมัติ

> **ขอบเขต:** ⑦A ครุภัณฑ์ (F7.1–F7.7) + ⑦B คำขออนุมัติ (F7.8–F7.12, F7.14)
> **branch:** `feat/itsm-phase-7` · **ฐาน:** `main` · **วันที่:** 2 กันยายน 2569
> **ไม่รวม:** F7.13 ไฟล์แนบ (เลื่อน) · ⑦C รายงาน F7.15–F7.23 (ยกไป Phase 8)

---

## 1. สิ่งที่ทำ

### ⑦A ทะเบียนครุภัณฑ์ IT

| ข้อ | สิ่งที่ได้ |
|---|---|
| F7.1 | CRUD ครุภัณฑ์ — หน้า `management/assets` + หน้ารายละเอียด `management/assets/[id]` |
| F7.2 | ฟิลด์ครบตาม spec · รหัสครุภัณฑ์เว้นว่างได้ ระบบออกรหัสรันนิ่งให้ `AS-256909-0001` |
| F7.3 | สถานะ 4 ตัว (ใช้งาน / ในคลัง / ส่งซ่อม / จำหน่ายแล้ว) พร้อมตารางการเปลี่ยนสถานะที่อนุญาต |
| F7.4 | `AssetHistory` — บันทึกอัตโนมัติทุกครั้งที่สถานะหรือผู้ครอบครองเปลี่ยน + ฟอร์มบันทึกการเคลื่อนไหวโดยตรง |
| F7.5 | QR Code ต่อชิ้น (PNG หรือ data URL) + หน้าพิมพ์ป้าย `management/assets/[id]/label` เลือกจำนวนป้ายต่อแผ่นได้ |
| F7.6 | รายการ "ใกล้หมดประกัน" + ปุ่มส่งแจ้งเตือนถึงผู้ครอบครอง (กันแจ้งซ้ำ 30 วัน) |
| F7.7 | นำเข้า CSV แบบบังคับ "ตรวจก่อน" (dry run) และส่งออก CSV ตามตัวกรองเดียวกับหน้าจอ |

### ⑦B คำขออนุมัติ / เบิกจ่าย

| ข้อ | สิ่งที่ได้ |
|---|---|
| F7.8 | CRUD คำขอ — หน้า `management/requests` + `new` + `[id]` · เลขที่ `RQ-256909-0001` |
| F7.9 | ประเภท: จัดซื้อ / เบิกวัสดุ / งบประมาณ / อื่นๆ |
| F7.10 | `ApprovalStep` หลายขั้น เรียงลำดับได้จากหน้าฟอร์ม (เลื่อนขึ้น/ลง) สูงสุด 5 ขั้น |
| F7.11 | Workflow: ฉบับร่าง → รออนุมัติ → อนุมัติแล้ว / ไม่อนุมัติ (+ ยกเลิก) · ยื่นแล้วห้ามแก้เนื้อหา |
| F7.12 | แท็บ "รออนุมัติของฉัน" + ปุ่มอนุมัติ/ไม่อนุมัติพร้อมความเห็น (บังคับกรอกเมื่อไม่อนุมัติ) |
| F7.14 | Timeline การอนุมัติ — ประกอบจากวันสร้างใบ + `decidedAt` ของแต่ละขั้น |

### แจ้งเตือน (ปิดค้างของ F8.6)

- `approval_requested` — ส่งตอนยื่นคำขอ และทุกครั้งที่ขั้นก่อนหน้าอนุมัติผ่านจนถึงคิวคนถัดไป
- `approval_decided` — แจ้งผู้ขอเมื่อคำขอได้ข้อยุติ (อนุมัติครบทุกขั้น หรือถูกตีตก)
- `asset_warranty_expiring` — **ชนิดใหม่** สำหรับ F7.6

---

## 2. ไฟล์ที่เพิ่ม/แก้

### ไฟล์ใหม่ (42 ไฟล์)

```
lib/    asset-workflow.ts  asset-schema.ts  asset-service.ts  asset-types.ts  asset-notify.ts
        approval-workflow.ts  approval-schema.ts  approval-service.ts
        approval-types.ts  approval-notify.ts

api/    assets/route.ts                     GET รายการ · POST เพิ่ม
        assets/[id]/route.ts                GET · PATCH · DELETE
        assets/[id]/history/route.ts        GET ประวัติ · POST บันทึกการเคลื่อนไหว
        assets/[id]/qrcode/route.ts         GET PNG หรือ ?format=dataurl
        assets/import/route.ts              POST นำเข้า CSV (รองรับ dryRun)
        assets/export/route.ts              GET ส่งออก CSV
        assets/warranty/route.ts            GET รายการใกล้หมดประกัน · POST กวาดแจ้งเตือน
        approvals/route.ts                  GET รายการ · POST สร้าง (ยื่นทันทีได้)
        approvals/[id]/route.ts             GET (+timeline) · PATCH · DELETE
        approvals/[id]/submit/route.ts      POST ยื่นเข้าสู่การอนุมัติ
        approvals/[id]/decide/route.ts      POST อนุมัติ / ไม่อนุมัติ
        approvals/[id]/cancel/route.ts      POST ยกเลิก
        approvals/pending/route.ts          GET รออนุมัติของฉัน (+ ?count=true)
        departments/route.ts                GET รายชื่อหน่วยงานสำหรับ dropdown

ui/     management/assets/{layout,page,AssetContent,AssetFormDialog,AssetImportDialog}.tsx
        management/assets/[id]/{page,AssetDetailContent}.tsx
        management/assets/[id]/label/{page,AssetLabelContent}.tsx
        management/requests/{layout,page,RequestContent}.tsx
        management/requests/new/{page,RequestFormContent}.tsx
        management/requests/[id]/{page,RequestDetailContent}.tsx
        components/asset/asset-badges.tsx  components/approval/approval-badges.tsx
```

### ไฟล์เดิมที่แก้ (2 ไฟล์ — ขออนุมัติแล้วตาม §16.5 ข้อ 4)

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `lib/notification-templates.ts` | เพิ่ม builder `approvalRequested()` / `approvalDecided()` / `assetWarrantyExpiring()` + ชนิด `asset_warranty_expiring` ใน `NOTIFICATION_TYPES` / `TYPE_LABEL` / `TYPE_EMOJI` · เปลี่ยน `assetLink()` ให้รับแค่ `{ id }` |
| `lib/notification-client-types.ts` | เพิ่มป้ายไทยของชนิดใหม่ 1 บรรทัด |

**ไม่แตะไฟล์ในตาราง M1–M13 เลยแม้แต่ไฟล์เดียว** — เพราะ Phase 0 วาง schema (`Asset`, `AssetHistory`,
`ApprovalRequest`, `ApprovalStep`), statement `asset`/`approval` ใน `permissions.ts`, เมนู sidebar,
`nextRequestNo()` และ dependencies (`qrcode`, `csv-parse`) ไว้ครบแล้ว
**ไม่มี migration ใหม่** — `prisma migrate status` ยืนยัน "Database schema is up to date!"

---

## 3. การตัดสินใจเชิงออกแบบ

1. **แยก "แก้ทะเบียน" ออกจาก "ทำอะไรกับของ"** — `PATCH /api/assets/[id]` ใช้แก้ข้อมูล เช่น ชื่อหรือราคา
   ส่วน `POST /api/assets/[id]/history` เป็นทางหลักของการจ่าย/โอน/ซ่อม/คืน/จำหน่าย
   ทั้งสองทางบันทึกประวัติให้อัตโนมัติ ประวัติจึงเล่าเรื่องเป็น "เหตุการณ์" ไม่ใช่ "การแก้ฟิลด์"

2. **การแก้ทะเบียนกับการบันทึกประวัติอยู่ใน `$transaction` เดียวกัน** — ถ้าอย่างใดอย่างหนึ่งล้ม
   ต้องล้มทั้งคู่ ไม่งั้นประวัติจะขัดกับสถานะจริง

3. **ยื่นคำขอมีเส้นทางเดียว** (`POST /submit` หรือ `POST /approvals` พร้อม `submit: true`)
   จึงมั่นใจได้ว่าไม่มีทางลัดที่ทำให้ใบเข้าสู่สถานะ "รออนุมัติ" โดยไม่มีใครได้รับแจ้ง

4. **ไม่อนุมัติ = ตกทั้งใบทันที** ไม่ไล่ขั้นต่อ — ตรงกับวิธีทำงานจริงของหนังสือราชการ
   ผู้ขอต้องแก้แล้วยื่นใหม่ (สถานะ `rejected` กลับไป `draft` ได้)

5. **ผู้อนุมัติต้องเป็น `manager` ขึ้นไป** — ตรวจตอนสร้าง/แก้คำขอด้วย `validateApprovers()`
   ถ้าปล่อยให้ตั้งใครก็ได้ ใบจะไปค้างกับคนที่กดอนุมัติไม่ได้

6. **แจ้งเตือนยิงแบบ "ไม่รอ"** (`void notify…`) ตามกติกาเดิมของ `ticket-notify` / `task-notify`
   หน้าจอไม่ควรค้างรออีเมล/LINE ออกก่อนจะตอบกลับ

7. **นำเข้า CSV บังคับตรวจก่อน** — ปุ่ม "นำเข้าจริง" ยังกดไม่ได้จนกว่าจะกด "ตรวจก่อน" หนึ่งรอบ
   แถวที่ผิดถูกข้ามและรายงานเป็นรายบรรทัด ไม่ล้มทั้งไฟล์เพราะพิมพ์ผิดแถวเดียว

8. **CSV ส่งออกนำหน้าด้วย BOM** เพื่อให้ Excel บน Windows อ่านภาษาไทยไม่เป็นตัวต่างด้าว

9. **`api/departments` แยกเป็นเส้นใหม่** ไม่ยัดใน `api/directory` — ที่นั่นเป็นรายชื่อ "คนและทีม"
   ส่วนหน่วยงานเป็นข้อมูลโครงสร้างองค์กรที่หน้าอื่นจะเรียกใช้ต่อไป

---

## 4. ผลการตรวจ (Definition of Done §16.4)

| เกต | ผล |
|---|---|
| **G1** ไฟล์ที่ commit | ผ่าน — ไม่มีไฟล์แปลกปลอม |
| **G2** `prisma validate` | ไม่เข้าเงื่อนไข (ไม่แตะ `schema.prisma`) |
| **G3** `prisma generate` | ไม่เข้าเงื่อนไข |
| **G4** `npx tsc --noEmit` | ✅ 0 error |
| **G5** `eslint` ไฟล์ที่แตะ | ✅ 0 error |
| **G6** `pnpm build` | ✅ `✓ Compiled successfully` · exit 0 · route ของเฟสขึ้นครบ 6 หน้า |
| **G7** อยู่ในขอบเขต | ✅ ไม่มีไฟล์นอก M1–M13 ที่ยังไม่ได้ขออนุมัติ (2 ไฟล์แจ้งเตือน ขอแล้ว) |

### ทดสอบตรรกะ — ผ่าน 34/34

คอมไพล์ `asset-workflow.ts` + `approval-workflow.ts` (สองไฟล์นี้ไม่มี import จึงรันเดี่ยวได้)
แล้วยิงเคสจริง ครอบคลุม:

- ตารางเปลี่ยนสถานะครุภัณฑ์ รวมกรณีปลายทาง `disposed` ที่กลับได้เฉพาะ `in_stock`
- การกระทำ 5 ชนิด → สถานะปลายทาง และเงื่อนไข "ใช้งานต้องมีผู้ครอบครอง"
- สถานะเอกสารคำขอ รวมกรณี `approved` ที่ไปไหนต่อไม่ได้
- **การไล่ขั้น**: ขั้นกลางผ่าน → ปลุกคนถัดไปถูกคน · ขั้นสุดท้ายผ่าน → อนุมัติแล้ว ·
  ขั้นกลางไม่อนุมัติ → ตกทั้งใบไม่ไล่ต่อ · ขั้นที่ส่งมาสลับลำดับก็ยังเรียงถูก
- **ใครกดได้**: เฉพาะผู้อนุมัติของขั้นที่รออยู่ · ขั้นถัดไปยังไม่ถึงคิว · คนนอก · ใบฉบับร่าง ·
  ขั้นที่ตัดสินไปแล้วกดซ้ำไม่ได้

### ทดสอบ endpoint — ผ่าน

รัน `pnpm dev` แล้วยิงจริง: ทุกเส้นตอบ `401 {"error":"กรุณาเข้าสู่ระบบ"}` เมื่อไม่มี session
(ยืนยัน NFR1 และยืนยันว่า route ทั้ง 14 เส้นขึ้นจริง) · หน้าจอทั้ง 3 route ตอบ 200 ·
`prisma migrate status` = "Database schema is up to date!"

---

## 5. ของค้าง

1. **ยังไม่ได้ทดสอบแบบล็อกอินจริง** — ที่ตรวจไปคือด่าน 401, การขึ้นของ route, ตรรกะ workflow
   และ build · ยังไม่เคยกดผ่านหน้าจอด้วยบัญชีจริง ควรทดสอบ 1 รอบก่อนใช้งานจริง:
   เพิ่มครุภัณฑ์ → จ่ายให้คน → ส่งซ่อม → คืนคลัง → ดูประวัติครบ 4 บรรทัด →
   สร้างคำขอ 2 ขั้น → ยื่น → ผู้อนุมัติขั้น 1 อนุมัติ → ขั้น 2 ได้รับแจ้ง → อนุมัติ → ผู้ขอได้รับแจ้ง

2. **F7.13 ไฟล์แนบคำขอ** — model `ApprovalAttachment` มีใน schema แล้ว และ `approvalDetailSelect`
   ดึงมาแสดงแล้ว แต่ยังไม่มีเส้น upload/download เพราะที่เก็บไฟล์ยังไม่สรุป (ค้างคู่กับ F1.7)

3. **ไม่มีตัวตั้งเวลาให้ F7.6** — การกวาดแจ้งเตือนประกันต้องกดเองจากหน้าจอ หรือให้ cron ภายนอก
   ยิง `POST /api/assets/warranty?days=90` · ออกแบบให้เรียกซ้ำได้ปลอดภัยแล้ว (กันแจ้งซ้ำ 30 วัน)

4. **ตัวกันแจ้งซ้ำอิง `linkUrl`** — ตาราง `Notification` ไม่ได้เก็บ id ของสิ่งที่ถูกอ้างถึงแยกไว้
   ถ้าอนาคตเปลี่ยนรูปแบบ URL ของหน้าครุภัณฑ์ ตัวกันซ้ำจะหลุด (แจ้งซ้ำ ไม่ใช่แจ้งพลาด)

5. **นำเข้า CSV ไม่มีคอลัมน์ผู้ครอบครอง** — แถวที่นำเข้าลงเป็นของในคลังเสมอ ตั้งใจให้เป็นแบบนี้
   เพื่อบังคับให้การจ่ายของเกิดผ่านหน้าจอและมีประวัติจริง

6. **หน้าคำขอยังไม่มีตัวนับบนเมนู** — `GET /api/approvals/pending?count=true` พร้อมใช้แล้ว
   แต่ยังไม่ได้ผูกกับ sidebar (แตะ `sidebar-data.ts` = M5 ต้องขออนุมัติ) — เก็บไว้ทำใน Phase 8

---

## 6. คำถามที่ต้องการคำตอบก่อนเฟสถัดไป

1. **ที่เก็บไฟล์แนบสรุปเป็นอะไร?** ค้างมาตั้งแต่ F1.7 และตอนนี้ค้างเพิ่มที่ F7.13 —
   ถ้าเลือก local volume ทำได้เลย ถ้าเลือก S3/R2 ต้องมี credential

2. **Phase 8 จะรวม 7C เข้าไปด้วยใช่ไหม?** F7.15–F7.23 ถูกยกมาแล้ว ทำให้ Phase 8 ใหญ่ขึ้นพอสมควร
   (Dashboard + รายงาน 6 ชุด + Export PDF/Excel + `ReportSnapshot`) — อาจต้องแบ่งเป็น 8A/8B

3. **branch `fix/claude-api-migration` จะเอาอย่างไรต่อ?** ยังพักอยู่ รอ `ANTHROPIC_API_KEY`
