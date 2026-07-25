ALTER TABLE "OutreachEmail"
ADD COLUMN "openTrackingToken" UUID,
ADD COLUMN "unsubscribeToken" UUID;

UPDATE "OutreachEmail"
SET
  "openTrackingToken" = gen_random_uuid(),
  "unsubscribeToken" = gen_random_uuid();

ALTER TABLE "OutreachEmail"
ALTER COLUMN "openTrackingToken" SET NOT NULL,
ALTER COLUMN "unsubscribeToken" SET NOT NULL;

CREATE UNIQUE INDEX "OutreachEmail_openTrackingToken_key"
ON "OutreachEmail"("openTrackingToken");

CREATE UNIQUE INDEX "OutreachEmail_unsubscribeToken_key"
ON "OutreachEmail"("unsubscribeToken");

ALTER TABLE "LinkClick"
ADD COLUMN "fingerprintHash" TEXT,
ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "LinkClick_organizationId_linkId_fingerprintHash_clickedAt_idx"
ON "LinkClick"("organizationId", "linkId", "fingerprintHash", "clickedAt");
