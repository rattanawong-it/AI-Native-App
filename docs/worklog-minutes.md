# เปลี่ยนหน่วยเวลาของ Time Log จาก "ชั่วโมง" เป็น "นาที"

> 8 กันยายน 2569 · branch `fix/worklog-minutes` · อ้างอิง spec §5.3, F3.5–F3.8, F7.18, F9.3
> งานแก้หน่วยข้อมูลแทรกนอกเฟส — แตกจาก `main` ตรง ไม่ปนกับแผน Phase 10 ที่ยังรออนุมัติ

---

## 1. ขอบเขต

| เรื่อง | สถานะ |
|---|---|
| `WorkLog.hours Decimal(5,2)` → `WorkLog.minutes Int` + migration แปลงข้อมูลเดิม | ✅ |
| ฟอร์มบันทึกเวลา (F3.5) + ฟอร์มปิดงาน (F3.6) กรอกเป็นนาที | ✅ |
| สรุปเวลาทำงาน (F3.7, F3.8) + Dashboard (F9.3, F9.4) แสดงเป็นนาที | ✅ |
| รายงานภาระงาน / ความคืบหน้าโครงการ + Excel export (F7.18, F7.19) | ✅ |
| ป้ายประเภทงาน `other` เปลี่ยนคำจาก "งานอื่นๆ" เป็น "งานประจำ" | ✅ |
| `Task.estimateHours` ของกระดาน SDLC | ⛔ **ไม่แตะ** — ยังเป็นชั่วโมงตามเดิม |
| `BusinessHour` / SLA / เวลาเฉลี่ยปิดงาน | ⛔ **ไม่แตะ** — คนละเรื่องกับ Time Log |

### เหตุผล

เจ้าหน้าที่ส่วนใหญ่ลงเวลางานย่อยระดับ 10–45 นาที การกรอกเป็นทศนิยมของชั่วโมง
(`0.25`, `0.75`) ทำให้กรอกผิดบ่อยและอ่านรายงานยาก จึงเก็บเป็นจำนวนเต็มนาที
ซึ่งเป็นหน่วยที่เล็กที่สุดที่ระบบต้องการจริง และตัดปัญหาปัดเศษทศนิยมออกทั้งหมด

---

## 2. สิ่งที่ทำ

### 2.1 Data model

- `prisma/schema.prisma` — `hours Decimal @db.Decimal(5,2)` → `minutes Int` (1–1440 นาที ต่อรายการ)
- `prisma/migrations/20260908150000_worklog_minutes/migration.sql`
  - เพิ่มคอลัมน์ `minutes` แบบ nullable ก่อน
  - `UPDATE ... SET minutes = GREATEST(1, ROUND(hours * 60)::int)` — 0.25 ชม. = 15 นาที ตรงพอดี
    ส่วนแถวที่ปัดแล้วได้ 0 ยกขึ้นเป็น 1 นาที เพื่อไม่ให้เหลือรายการเวลาศูนย์
  - `SET NOT NULL` แล้วจึง `DROP COLUMN "hours"`
  - ⚠️ มี `DROP COLUMN` — ต้องขออนุมัติก่อน apply ตาม §16.5 ข้อ 3

### 2.2 Validation & service

- `lib/worklog-schema.ts` — ฟิลด์ `minutes`: จำนวนเต็ม > 0 และ ≤ 1440
- `lib/ticket-schema.ts` — `workHours` → `workMinutes` (int, 0–1440) ใน `changeStatusSchema`
- `lib/worklog-service.ts` — `workLogSelect` / `WorkLogDto` ใช้ `minutes` ตรงๆ ไม่ต้องแปลง Decimal อีก · ตัด `roundHours()` ทิ้ง
- `lib/worklog-types.ts` — `HoursBucket` → `MinutesBucket`, `totalHours` → `totalMinutes`,
  `formatHours()` → `formatMinutes()` (แสดง "90 นาที")
- `lib/project-service.ts` — `loggedHoursByTask()` หารกลับเป็นชั่วโมง (ทศนิยม 2 ตำแหน่ง) **ที่จุดนี้จุดเดียว**
  เพราะการ์ดบนกระดานเทียบกับ `Task.estimateHours` ซึ่งยังเป็นชั่วโมง
- `lib/dashboard-service.ts` / `lib/dashboard-types.ts` — `hoursThisWeek` → `minutesThisWeek`, `topWorkload[].minutes`
- `lib/report-service.ts` / `lib/report-types.ts` / `lib/report-export.ts` — `WorkloadRow.minutes`,
  `WorkloadSection.totalMinutes`, `ProjectProgressRow.minutes` + หัวคอลัมน์ Excel

### 2.3 API

- `app/api/worklogs/route.ts`, `[id]/route.ts`, `summary/route.ts` — รับ/คืนค่าเป็นนาที
- `app/api/tickets/[id]/status/route.ts` — `workMinutes` สร้าง `WorkLog` ตอนปิดงาน + ข้อความ error เป็นนาที
- `app/api/reports/snapshots/route.ts` — `workloadMinutes()` อ่าน snapshot เก่าที่เก็บ `totalHours` แล้วคูณ 60
  ตารางเทียบย้อนหลังจึงไม่มีช่องว่างเปล่า

### 2.4 UI

- `service/my-work/TimeLogPanel.tsx` — ช่องกรอก `min=1 max=1440 step=5`, กราฟรายวันและยอดรวมเป็นนาที
- `service/tickets/[id]/TicketDetailContent.tsx` — `ResolveDialog` กรอกนาที
- `admin/sla/TicketRulesCard.tsx` — คำอธิบายกฎ `require_worklog_on_resolve`
- `dashboard/DashboardContent.tsx`, `management/reports/*` — ป้ายและหน่วยทั้งหมด

---

## 3. ผลตรวจ (เกต §16.4)

| เกต | ผล |
|---|---|
| G1 ไฟล์ที่ commit | ✅ 28 ไฟล์ (โค้ด/เอกสารแก้ 26 + `docs/worklog-minutes.md` + migration) — ไม่มีไฟล์แปลกปลอม |
| G2 `prisma validate` | ✅ ผ่าน |
| G3 `prisma generate` | ✅ ผ่าน |
| G4 `tsc --noEmit` | ✅ **0 error** |
| G5 lint ไฟล์ที่แตะ | ✅ 0 error / 0 warning |
| G6 `next build` | ✅ ผ่าน |
| G7 อยู่ในขอบเขต | ✅ ไม่มีไฟล์นอกขอบเขตข้างต้น |

---

## 4. ผลบนข้อมูลจริง (8 ก.ย. 2569)

### 4.1 apply migration ลง Neon

`prisma migrate deploy` (ไม่ใช้ `migrate dev`/`reset` ตาม §16.5 ข้อ 3) — ผู้ใช้อนุมัติ `DROP COLUMN` ก่อนรัน

| ตรวจ | ผล |
|---|---|
| คอลัมน์ `work_log` | `hours` หายไป · `minutes integer NOT NULL` เข้ามาแทน |
| ข้อมูลเดิม 17 แถว | แปลงครบ รวม 561 นาที · ต่ำสุด 1 · สูงสุด 120 |
| ค่าที่แปลง | 1 ชม. → 60 · 0.5 → 30 · 0.6 → 36 · 0.3 → 18 · เศษต่ำกว่าครึ่งนาที → 1 |
| `prisma migrate status` | Database schema is up to date — ไม่มี drift |

### 4.2 ทดสอบผ่านหน้าจอจริง (บัญชี admin, dev server)

| จุดที่ทดสอบ | ผล |
|---|---|
| My Work → บันทึกเวลา — สร้างรายการ 45 นาที | ✅ ยอดรวมขยับ 150 → 195 นาที · กราฟรายวันเพิ่มแท่งวันที่ 8 |
| แก้รายการเป็น 50 นาที | ✅ ยอดรวม 200 นาที · ป้าย "50 นาที" ในรายการ |
| กรอก 1500 นาที | ✅ server ตีกลับ "หนึ่งรายการบันทึกได้ไม่เกิน 1440 นาที (24 ชั่วโมง)" |
| ลบรายการทดสอบ | ✅ กล่องยืนยันแสดง "50 นาที" · ลบแล้วกลับเป็น 150 นาที (ไม่เหลือข้อมูลทดสอบค้าง) |
| ฟอร์มปิดงาน (F3.6) | ✅ ป้าย "จำนวนนาทีที่ใช้" · ปุ่มปิดงานยังกดไม่ได้เมื่อเว้นว่าง และเมื่อกรอก 12.5 (ไม่ใช่จำนวนเต็ม) |
| รายงานภาระงาน (F3.8/F7.18) | ✅ "เวลาทำงานรวมทั้งศูนย์ 326 นาที" · รายคน 200/96/30 นาที · แยกประเภท "งานประจำ 200 นาที" |
| รายงานสรุป | ✅ "เวลารวมที่บันทึกไว้ในช่วงนี้ 611 นาที" · คอลัมน์ "นาที" ทั้งตารางภาระงานและตารางโครงการ |
| Snapshot เก่า (บันทึก 3 ก.ย. ด้วย `totalHours`) | ✅ ตารางเปรียบเทียบย้อนหลังแสดง 108 นาที — เส้นทางแปลงค่าเก่าใช้ได้ |
| Dashboard (F9.3/F9.4) | ✅ "เวลาทำงานสัปดาห์นี้ 200 นาที" · ภาระงานรายคน "ค้าง 0 งาน · 317 นาที" |

> ไม่ได้กดปิดงานจริงในการทดสอบ เพราะการเปลี่ยนสถานะเป็น `resolved` จะส่งแจ้งเตือนออกไปหาผู้แจ้งจริง
> — ตรวจเฉพาะเงื่อนไขเปิด/ปิดปุ่มซึ่งเป็นส่วนที่แก้ในงานนี้

---

## 5. ของค้าง

1. **Excel export** ยังไม่ได้เปิดไฟล์ที่ดาวน์โหลดมาดูด้วยตา — หัวคอลัมน์เปลี่ยนเป็น "นาทีที่บันทึก" / "นาทีในช่วงนี้" แล้วในโค้ดและผ่าน `tsc`
2. `Task.estimateHours` ยังเป็นชั่วโมง — ถ้าต้องการให้ทั้งระบบเป็นนาทีหน่วยเดียว ต้องเปิดเป็นงานแยก
