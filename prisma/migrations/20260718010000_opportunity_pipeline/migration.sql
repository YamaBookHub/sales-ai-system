-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('uncontacted', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost', 'excluded');

-- CreateEnum
CREATE TYPE "OpportunityLossReason" AS ENUM ('no_interest', 'no_budget', 'timing', 'no_response', 'competitor', 'service_mismatch', 'contact_unavailable', 'duplicate', 'other');

-- CreateEnum
CREATE TYPE "OpportunityChangeSource" AS ENUM ('manual', 'system', 'migration');

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "ownerId" UUID,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'uncontacted',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedAmount" INTEGER,
    "wonAmount" INTEGER,
    "meetingScheduledAt" TIMESTAMP(3),
    "expectedCloseDate" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lossReason" "OpportunityLossReason",
    "lossReasonDetail" TEXT,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Opportunity_probability_check" CHECK ("probability" >= 0 AND "probability" <= 100),
    CONSTRAINT "Opportunity_expectedAmount_check" CHECK ("expectedAmount" IS NULL OR "expectedAmount" >= 0),
    CONSTRAINT "Opportunity_wonAmount_check" CHECK ("wonAmount" IS NULL OR "wonAmount" >= 0)
);

-- CreateTable
CREATE TABLE "OpportunityStageHistory" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "fromStage" "OpportunityStage",
    "toStage" "OpportunityStage" NOT NULL,
    "changedById" UUID,
    "source" "OpportunityChangeSource" NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "reason" TEXT,
    "operationKey" TEXT,
    "versionAfter" INTEGER NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_leadId_key" ON "Opportunity"("leadId");
CREATE INDEX "Opportunity_stage_updatedAt_idx" ON "Opportunity"("stage", "updatedAt");
CREATE INDEX "Opportunity_ownerId_stage_idx" ON "Opportunity"("ownerId", "stage");
CREATE INDEX "Opportunity_expectedCloseDate_idx" ON "Opportunity"("expectedCloseDate");
CREATE UNIQUE INDEX "OpportunityStageHistory_operationKey_key" ON "OpportunityStageHistory"("operationKey");
CREATE INDEX "OpportunityStageHistory_opportunityId_createdAt_idx" ON "OpportunityStageHistory"("opportunityId", "createdAt");
CREATE INDEX "OpportunityStageHistory_toStage_createdAt_idx" ON "OpportunityStageHistory"("toStage", "createdAt");
CREATE INDEX "OpportunityStageHistory_changedById_createdAt_idx" ON "OpportunityStageHistory"("changedById", "createdAt");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one opportunity for every active lead. Facts from replies and sent mail
-- take precedence over the legacy LeadStatus workflow value.
WITH lead_stage AS (
SELECT
    lead."id" AS "leadId",
    CASE
        WHEN lead."status" = 'archived'
          OR company."isBlocked" = TRUE
          OR (
            EXISTS (
              SELECT 1 FROM "ContactPerson" contact
              WHERE contact."companyId" = lead."companyId" AND contact."deletedAt" IS NULL
            )
            AND NOT EXISTS (
              SELECT 1 FROM "ContactPerson" contact
              WHERE contact."companyId" = lead."companyId"
                AND contact."deletedAt" IS NULL
                AND contact."isUnsubscribed" = FALSE
            )
          ) THEN 'excluded'::"OpportunityStage"
        WHEN lead."status" = 'meeting_candidate'
          OR EXISTS (
            SELECT 1 FROM "OutreachEmail" mail
            JOIN "EmailReply" reply ON reply."emailId" = mail."id"
            WHERE mail."leadId" = lead."id" AND reply."category" = 'meeting_request'
          ) THEN 'meeting'::"OpportunityStage"
        WHEN EXISTS (
            SELECT 1 FROM "OutreachEmail" mail
            JOIN "EmailReply" reply ON reply."emailId" = mail."id"
            WHERE mail."leadId" = lead."id" AND reply."category" = 'not_interested'
          ) THEN 'lost'::"OpportunityStage"
        WHEN lead."status" = 'replied'
          OR EXISTS (
            SELECT 1 FROM "OutreachEmail" mail
            JOIN "EmailReply" reply ON reply."emailId" = mail."id"
            WHERE mail."leadId" = lead."id"
          ) THEN 'replied'::"OpportunityStage"
        WHEN lead."sentAt" IS NOT NULL
          OR lead."status" IN ('contacted', 'no_response')
          OR EXISTS (
            SELECT 1 FROM "OutreachEmail" mail
            WHERE mail."leadId" = lead."id"
              AND (mail."sentAt" IS NOT NULL OR mail."status" = 'sent')
          ) THEN 'contacted'::"OpportunityStage"
        ELSE 'uncontacted'::"OpportunityStage"
    END AS "stage"
FROM "SalesLead" lead
JOIN "Company" company ON company."id" = lead."companyId"
WHERE lead."deletedAt" IS NULL
)
INSERT INTO "Opportunity" (
    "id", "leadId", "stage", "probability", "lossReason", "lostAt",
    "stageChangedAt", "version", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    lead_stage."leadId",
    lead_stage."stage",
    CASE lead_stage."stage"
        WHEN 'contacted' THEN 10
        WHEN 'replied' THEN 25
        WHEN 'meeting' THEN 50
        ELSE 0
    END,
    CASE WHEN lead_stage."stage" = 'lost' THEN 'no_interest'::"OpportunityLossReason" ELSE NULL END,
    CASE WHEN lead_stage."stage" = 'lost' THEN CURRENT_TIMESTAMP ELSE NULL END,
    CURRENT_TIMESTAMP,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM lead_stage
ON CONFLICT ("leadId") DO NOTHING;

-- Record an append-only initial history row for every backfilled opportunity.
INSERT INTO "OpportunityStageHistory" (
    "id", "opportunityId", "fromStage", "toStage", "source", "sourceId",
    "reason", "operationKey", "versionAfter", "snapshot", "createdAt"
)
SELECT
    gen_random_uuid(),
    opportunity."id",
    NULL,
    opportunity."stage",
    'migration'::"OpportunityChangeSource",
    opportunity."leadId"::text,
    'legacy_backfill',
    'migration:opportunity:' || opportunity."leadId"::text,
    opportunity."version",
    jsonb_build_object(
      'stage', opportunity."stage",
      'probability', opportunity."probability",
      'lossReason', opportunity."lossReason",
      'backfillBasis', CASE opportunity."stage"
        WHEN 'excluded' THEN 'company_block_or_unsubscribe'
        WHEN 'replied' THEN 'recorded_reply'
        WHEN 'meeting' THEN 'legacy_lead_status_meeting'
        WHEN 'lost' THEN 'legacy_lead_status_lost'
        WHEN 'contacted' THEN 'sent_mail_or_legacy_contacted_status'
        ELSE 'no_recorded_contact'
      END
    ),
    CURRENT_TIMESTAMP
FROM "Opportunity" opportunity
ON CONFLICT ("operationKey") DO NOTHING;

-- Abort the migration instead of silently leaving an active lead without an opportunity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SalesLead" lead
    LEFT JOIN "Opportunity" opportunity ON opportunity."leadId" = lead."id"
    WHERE lead."deletedAt" IS NULL AND opportunity."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Opportunity backfill incomplete: active SalesLead without Opportunity';
  END IF;
END $$;
