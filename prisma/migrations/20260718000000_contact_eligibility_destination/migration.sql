ALTER TABLE "OutreachEmail"
ADD COLUMN "destinationType" TEXT,
ADD COLUMN "destinationValue" TEXT,
ADD COLUMN "destinationKey" TEXT;

CREATE INDEX "OutreachEmail_destinationKey_status_idx"
ON "OutreachEmail"("destinationKey", "status");
