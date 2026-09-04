-- CreateTable
CREATE TABLE "service_category_assignee" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_category_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_category_assignee_categoryId_idx" ON "service_category_assignee"("categoryId");

-- CreateIndex
CREATE INDEX "service_category_assignee_userId_idx" ON "service_category_assignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "service_category_assignee_categoryId_userId_key" ON "service_category_assignee"("categoryId", "userId");

-- AddForeignKey
ALTER TABLE "service_category_assignee" ADD CONSTRAINT "service_category_assignee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_category_assignee" ADD CONSTRAINT "service_category_assignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill (ข้อ 19 / F2.10) — ย้ายผู้รับผิดชอบเดิม 1 คนต่อหมวด เข้าตารางใหม่
-- ไม่ลบ service_category."defaultAssigneeId" (คงไว้เป็น deprecated เพื่อย้อนกลับได้)
-- ใช้ createdAt ของหมวดเดิมเพื่อให้ลำดับ tie-breaker คงที่ · ON CONFLICT ทำให้รันซ้ำได้
INSERT INTO "service_category_assignee" ("id", "categoryId", "userId", "createdAt")
SELECT gen_random_uuid()::text, sc."id", sc."defaultAssigneeId", sc."createdAt"
FROM "service_category" sc
WHERE sc."defaultAssigneeId" IS NOT NULL
ON CONFLICT ("categoryId", "userId") DO NOTHING;
