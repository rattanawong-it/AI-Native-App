-- Time Log เปลี่ยนหน่วยเวลาจาก "ชั่วโมง" (Decimal 5,2) เป็น "นาที" (Int)
-- ข้อมูลเดิมถูกแปลงด้วย hours * 60 แล้วปัดเป็นจำนวนเต็ม — 0.25 ชม. = 15 นาที ตรงพอดี
-- แถวที่ปัดแล้วได้ 0 (เศษน้อยกว่าครึ่งนาที) ยกขึ้นเป็น 1 นาที เพื่อไม่ให้เหลือรายการเวลาศูนย์

ALTER TABLE "work_log" ADD COLUMN "minutes" INTEGER;

UPDATE "work_log" SET "minutes" = GREATEST(1, ROUND("hours" * 60)::int);

ALTER TABLE "work_log" ALTER COLUMN "minutes" SET NOT NULL;

ALTER TABLE "work_log" DROP COLUMN "hours";
