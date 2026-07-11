ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "sourceTotalAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceProjectCount" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceSupporterCount" INTEGER;

ALTER TABLE "CrowdfundingProject"
ADD COLUMN IF NOT EXISTS "daysLeft" INTEGER,
ADD COLUMN IF NOT EXISTS "location" TEXT;

CREATE INDEX IF NOT EXISTS "CrowdfundingProject_daysLeft_idx" ON "CrowdfundingProject"("daysLeft");
CREATE INDEX IF NOT EXISTS "CrowdfundingProject_location_idx" ON "CrowdfundingProject"("location");
