-- ลำดับชั้นหน่วยงาน — เพิ่มแบบ additive ล้วน (ไม่มี DROP / TRUNCATE ตาม spec §16.5 ข้อ 3)
-- รหัสงานสารบรรณ 6 หลักบอกลำดับชั้นในตัว: 010000 สำนัก › 010100 ฝ่าย › 010103 งาน
-- แถวเดิมทั้งหมดได้ parentId = NULL และ level = 1 ซึ่งเป็นพฤติกรรมเดียวกับก่อนแก้

-- AlterTable
ALTER TABLE "department" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "department_parentId_idx" ON "department"("parentId");

-- CreateIndex
CREATE INDEX "department_active_code_idx" ON "department"("active", "code");

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
