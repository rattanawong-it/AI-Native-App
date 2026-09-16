-- บันทึกเวลาทำงานระบุ "หัวข้อบริการ" จาก Service Catalog ได้ (spec §21)
-- คอลัมน์เป็น NULL ได้เพราะบันทึกเดิมทั้งหมดยังไม่มีหัวข้อบริการ — ฟอร์มบังคับเฉพาะประเภท "งานประจำ"
-- ลบหมวดหมู่แล้วบันทึกเวลายังอยู่ (SET NULL) เพราะเวลาที่ลงไว้เป็นข้อเท็จจริงของคนทำงาน

ALTER TABLE "work_log" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "work_log_categoryId_idx" ON "work_log"("categoryId");

ALTER TABLE "work_log" ADD CONSTRAINT "work_log_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
