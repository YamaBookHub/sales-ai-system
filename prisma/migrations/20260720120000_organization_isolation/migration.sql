-- 全DDL・backfillを原子的に適用し、移行中の書き込みを遮断する。
BEGIN;

LOCK TABLE
    "User", "UserSession", "Company", "ContactPerson", "CrowdfundingProject",
    "SalesLead", "LeadScore", "OutreachEmail", "MailTemplate", "MailChecklistItem",
    "EmailEvent", "EmailReply", "TrackedLink", "LinkClick", "MailAttachment",
    "AiGeneration", "AiUsageLedger", "LeadAnalysisRevision", "Task", "Opportunity",
    "OpportunityStageHistory", "AuditLog"
IN ACCESS EXCLUSIVE MODE;

-- 既存データを受け入れる既定組織を先に作成する。
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMembership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_isActive_idx" ON "Organization"("isActive");
CREATE INDEX "OrganizationMembership_userId_isActive_idx" ON "OrganizationMembership"("userId", "isActive");
CREATE INDEX "OrganizationMembership_organizationId_role_isActive_idx" ON "OrganizationMembership"("organizationId", "role", "isActive");
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

INSERT INTO "Organization" ("id", "slug", "name", "isActive", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-4000-8000-000000000007'::uuid,
    'default',
    '既定組織',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- User.roleを削除する前に組織内roleへ移す。既存User IDをmembership IDとして再利用する。
INSERT INTO "OrganizationMembership" (
    "id", "organizationId", "userId", "displayName", "role", "isActive", "createdAt", "updatedAt"
)
SELECT
    "id",
    '00000000-0000-4000-8000-000000000007'::uuid,
    "id",
    "name",
    "role",
    "isActive" AND "deletedAt" IS NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

-- DropForeignKey
ALTER TABLE "ContactPerson" DROP CONSTRAINT "ContactPerson_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CrowdfundingProject" DROP CONSTRAINT "CrowdfundingProject_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesLead" DROP CONSTRAINT "SalesLead_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesLead" DROP CONSTRAINT "SalesLead_projectId_fkey";

-- DropForeignKey
ALTER TABLE "LeadScore" DROP CONSTRAINT "LeadScore_leadId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachEmail" DROP CONSTRAINT "OutreachEmail_leadId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachEmail" DROP CONSTRAINT "OutreachEmail_companyId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachEmail" DROP CONSTRAINT "OutreachEmail_contactId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachEmail" DROP CONSTRAINT "OutreachEmail_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "OutreachEmail" DROP CONSTRAINT "OutreachEmail_analysisRevisionId_fkey";

-- DropForeignKey
ALTER TABLE "MailChecklistItem" DROP CONSTRAINT "MailChecklistItem_emailId_fkey";

-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_emailId_fkey";

-- DropForeignKey
ALTER TABLE "EmailReply" DROP CONSTRAINT "EmailReply_emailId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedLink" DROP CONSTRAINT "TrackedLink_emailId_fkey";

-- DropForeignKey
ALTER TABLE "LinkClick" DROP CONSTRAINT "LinkClick_linkId_fkey";

-- DropForeignKey
ALTER TABLE "MailAttachment" DROP CONSTRAINT "MailAttachment_emailId_fkey";

-- DropForeignKey
ALTER TABLE "AiGeneration" DROP CONSTRAINT "AiGeneration_leadId_fkey";

-- DropForeignKey
ALTER TABLE "AiGeneration" DROP CONSTRAINT "AiGeneration_emailId_fkey";

-- DropForeignKey
ALTER TABLE "LeadAnalysisRevision" DROP CONSTRAINT "LeadAnalysisRevision_leadId_fkey";

-- DropForeignKey
ALTER TABLE "LeadAnalysisRevision" DROP CONSTRAINT "LeadAnalysisRevision_projectId_fkey";

-- DropForeignKey
ALTER TABLE "LeadAnalysisRevision" DROP CONSTRAINT "LeadAnalysisRevision_sourceGenerationId_fkey";

-- DropForeignKey
ALTER TABLE "LeadAnalysisRevision" DROP CONSTRAINT "LeadAnalysisRevision_changedById_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_leadId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_leadId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "OpportunityStageHistory" DROP CONSTRAINT "OpportunityStageHistory_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "OpportunityStageHistory" DROP CONSTRAINT "OpportunityStageHistory_changedById_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropIndex
DROP INDEX "User_role_isActive_idx";

-- DropIndex
DROP INDEX "UserSession_userId_revokedAt_idx";

-- DropIndex
DROP INDEX "Company_name_idx";

-- DropIndex
DROP INDEX "Company_normalizedName_idx";

-- DropIndex
DROP INDEX "Company_isBlocked_idx";

-- DropIndex
DROP INDEX "ContactPerson_companyId_idx";

-- DropIndex
DROP INDEX "ContactPerson_email_idx";

-- DropIndex
DROP INDEX "ContactPerson_isUnsubscribed_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_url_key";

-- DropIndex
DROP INDEX "CrowdfundingProject_platformId_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_companyId_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_status_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_amount_supporterCount_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_endDate_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_daysLeft_idx";

-- DropIndex
DROP INDEX "CrowdfundingProject_location_idx";

-- DropIndex
DROP INDEX "SalesLead_status_priority_idx";

-- DropIndex
DROP INDEX "SalesLead_score_idx";

-- DropIndex
DROP INDEX "SalesLead_nextActionAt_idx";

-- DropIndex
DROP INDEX "SalesLead_companyId_projectId_key";

-- DropIndex
DROP INDEX "LeadScore_leadId_idx";

-- DropIndex
DROP INDEX "LeadScore_totalScore_idx";

-- DropIndex
DROP INDEX "OutreachEmail_status_idx";

-- DropIndex
DROP INDEX "OutreachEmail_leadId_idx";

-- DropIndex
DROP INDEX "OutreachEmail_companyId_idx";

-- DropIndex
DROP INDEX "OutreachEmail_analysisRevisionId_idx";

-- DropIndex
DROP INDEX "OutreachEmail_destinationKey_status_idx";

-- DropIndex
DROP INDEX "OutreachEmail_gmailThreadId_idx";

-- DropIndex
DROP INDEX "OutreachEmail_scheduledAt_idx";

-- DropIndex
DROP INDEX "MailTemplate_key_key";

-- DropIndex
DROP INDEX "MailTemplate_channel_isActive_idx";

-- DropIndex
DROP INDEX "MailChecklistItem_emailId_idx";

-- DropIndex
DROP INDEX "MailChecklistItem_checked_idx";

-- DropIndex
DROP INDEX "MailChecklistItem_emailId_key_key";

-- DropIndex
DROP INDEX "EmailEvent_emailId_type_idx";

-- DropIndex
DROP INDEX "EmailEvent_createdAt_idx";

-- DropIndex
DROP INDEX "EmailReply_gmailMessageId_key";

-- DropIndex
DROP INDEX "EmailReply_emailId_idx";

-- DropIndex
DROP INDEX "EmailReply_category_idx";

-- DropIndex
DROP INDEX "EmailReply_receivedAt_idx";

-- DropIndex
DROP INDEX "TrackedLink_emailId_idx";

-- DropIndex
DROP INDEX "LinkClick_linkId_idx";

-- DropIndex
DROP INDEX "LinkClick_clickedAt_idx";

-- DropIndex
DROP INDEX "MailAttachment_emailId_idx";

-- DropIndex
DROP INDEX "MailAttachment_type_idx";

-- DropIndex
DROP INDEX "AiGeneration_type_idx";

-- DropIndex
DROP INDEX "AiGeneration_leadId_idx";

-- DropIndex
DROP INDEX "AiGeneration_emailId_idx";

-- DropIndex
DROP INDEX "AiGeneration_createdAt_idx";

-- DropIndex
DROP INDEX "AiUsageLedger_provider_createdAt_status_idx";

-- DropIndex
DROP INDEX "LeadAnalysisRevision_leadId_status_version_idx";

-- DropIndex
DROP INDEX "LeadAnalysisRevision_projectId_idx";

-- DropIndex
DROP INDEX "LeadAnalysisRevision_sourceGenerationId_idx";

-- DropIndex
DROP INDEX "LeadAnalysisRevision_changedById_idx";

-- DropIndex
DROP INDEX "LeadAnalysisRevision_leadId_version_key";

-- DropIndex
DROP INDEX "Task_status_dueAt_idx";

-- DropIndex
DROP INDEX "Task_leadId_idx";

-- DropIndex
DROP INDEX "Task_assigneeId_idx";

-- DropIndex
DROP INDEX "Opportunity_leadId_key";

-- DropIndex
DROP INDEX "Opportunity_stage_updatedAt_idx";

-- DropIndex
DROP INDEX "Opportunity_ownerId_stage_idx";

-- DropIndex
DROP INDEX "Opportunity_expectedCloseDate_idx";

-- DropIndex
DROP INDEX "OpportunityStageHistory_operationKey_key";

-- DropIndex
DROP INDEX "OpportunityStageHistory_opportunityId_createdAt_idx";

-- DropIndex
DROP INDEX "OpportunityStageHistory_toStage_createdAt_idx";

-- DropIndex
DROP INDEX "OpportunityStageHistory_changedById_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_entityType_entityId_idx";

-- DropIndex
DROP INDEX "AuditLog_action_idx";

-- DropIndex
DROP INDEX "AuditLog_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_userId_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_sessionId_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_action_createdAt_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "ContactPerson" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "CrowdfundingProject" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "SalesLead" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "LeadScore" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "OutreachEmail" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "MailTemplate" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "MailChecklistItem" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "EmailEvent" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "EmailReply" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "TrackedLink" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "LinkClick" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "MailAttachment" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "AiGeneration" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "AiUsageLedger" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "LeadAnalysisRevision" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "OpportunityStageHistory" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" UUID;

-- 既存行は全て既定組織へ明示的に移す。
UPDATE "UserSession" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "Company" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "ContactPerson" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "CrowdfundingProject" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "SalesLead" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "LeadScore" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "OutreachEmail" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "MailTemplate" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "MailChecklistItem" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "EmailEvent" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "EmailReply" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "TrackedLink" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "LinkClick" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "MailAttachment" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "AiGeneration" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "AiUsageLedger" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "LeadAnalysisRevision" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "Task" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "Opportunity" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "OpportunityStageHistory" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;
UPDATE "AuditLog" SET "organizationId" = '00000000-0000-4000-8000-000000000007'::uuid;

-- 旧版ではAuditLog.sessionIdに外部キーがなかった。存在しないsession参照だけを外し、監査記録本体は保持する。
UPDATE "AuditLog" AS audit
SET "sessionId" = NULL
WHERE audit."sessionId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "UserSession" AS session
    WHERE session."id" = audit."sessionId"
  );

-- NULLが残っていれば制約作成前に移行を停止し、トランザクション全体を戻す。
DO $$
DECLARE
    table_name TEXT;
    null_count BIGINT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'UserSession', 'Company', 'ContactPerson', 'CrowdfundingProject', 'SalesLead',
        'LeadScore', 'OutreachEmail', 'MailTemplate', 'MailChecklistItem', 'EmailEvent',
        'EmailReply', 'TrackedLink', 'LinkClick', 'MailAttachment', 'AiGeneration',
        'AiUsageLedger', 'LeadAnalysisRevision', 'Task', 'Opportunity',
        'OpportunityStageHistory', 'AuditLog'
    ] LOOP
        EXECUTE format('SELECT count(*) FROM %I WHERE "organizationId" IS NULL', table_name) INTO null_count;
        IF null_count > 0 THEN
            RAISE EXCEPTION 'organizationId backfill failed for %: % rows', table_name, null_count;
        END IF;
    END LOOP;
END $$;

ALTER TABLE "UserSession" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ContactPerson" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CrowdfundingProject" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesLead" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeadScore" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OutreachEmail" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "MailTemplate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "MailChecklistItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmailEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmailReply" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TrackedLink" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LinkClick" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "MailAttachment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AiGeneration" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AiUsageLedger" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeadAnalysisRevision" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OpportunityStageHistory" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;

-- 旧sessionは組織選択を経ていないため全て失効させる。
UPDATE "UserSession"
SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "UserSession_organizationId_userId_revokedAt_idx" ON "UserSession"("organizationId", "userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_organizationId_id_key" ON "UserSession"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Company_organizationId_name_idx" ON "Company"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Company_organizationId_normalizedName_idx" ON "Company"("organizationId", "normalizedName");

-- CreateIndex
CREATE INDEX "Company_organizationId_isBlocked_idx" ON "Company"("organizationId", "isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_id_key" ON "Company"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ContactPerson_organizationId_companyId_idx" ON "ContactPerson"("organizationId", "companyId");

-- CreateIndex
CREATE INDEX "ContactPerson_organizationId_email_idx" ON "ContactPerson"("organizationId", "email");

-- CreateIndex
CREATE INDEX "ContactPerson_organizationId_isUnsubscribed_idx" ON "ContactPerson"("organizationId", "isUnsubscribed");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPerson_organizationId_id_key" ON "ContactPerson"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_platformId_idx" ON "CrowdfundingProject"("organizationId", "platformId");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_companyId_idx" ON "CrowdfundingProject"("organizationId", "companyId");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_status_idx" ON "CrowdfundingProject"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_amount_supporterCount_idx" ON "CrowdfundingProject"("organizationId", "amount", "supporterCount");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_endDate_idx" ON "CrowdfundingProject"("organizationId", "endDate");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_daysLeft_idx" ON "CrowdfundingProject"("organizationId", "daysLeft");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_organizationId_location_idx" ON "CrowdfundingProject"("organizationId", "location");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdfundingProject_organizationId_id_key" ON "CrowdfundingProject"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdfundingProject_organizationId_url_key" ON "CrowdfundingProject"("organizationId", "url");

-- CreateIndex
CREATE INDEX "SalesLead_organizationId_status_priority_idx" ON "SalesLead"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "SalesLead_organizationId_score_idx" ON "SalesLead"("organizationId", "score");

-- CreateIndex
CREATE INDEX "SalesLead_organizationId_nextActionAt_idx" ON "SalesLead"("organizationId", "nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_organizationId_id_key" ON "SalesLead"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_organizationId_companyId_projectId_key" ON "SalesLead"("organizationId", "companyId", "projectId");

-- CreateIndex
CREATE INDEX "LeadScore_organizationId_leadId_idx" ON "LeadScore"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "LeadScore_organizationId_totalScore_idx" ON "LeadScore"("organizationId", "totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "LeadScore_organizationId_id_key" ON "LeadScore"("organizationId", "id");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_status_idx" ON "OutreachEmail"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_leadId_idx" ON "OutreachEmail"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_companyId_idx" ON "OutreachEmail"("organizationId", "companyId");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_analysisRevisionId_idx" ON "OutreachEmail"("organizationId", "analysisRevisionId");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_destinationKey_status_idx" ON "OutreachEmail"("organizationId", "destinationKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEmail_organizationId_gmailMessageId_key" ON "OutreachEmail"("organizationId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_gmailThreadId_idx" ON "OutreachEmail"("organizationId", "gmailThreadId");

-- CreateIndex
CREATE INDEX "OutreachEmail_organizationId_scheduledAt_idx" ON "OutreachEmail"("organizationId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEmail_organizationId_id_key" ON "OutreachEmail"("organizationId", "id");

-- CreateIndex
CREATE INDEX "MailTemplate_organizationId_channel_isActive_idx" ON "MailTemplate"("organizationId", "channel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MailTemplate_organizationId_id_key" ON "MailTemplate"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MailTemplate_organizationId_key_key" ON "MailTemplate"("organizationId", "key");

-- CreateIndex
CREATE INDEX "MailChecklistItem_organizationId_emailId_idx" ON "MailChecklistItem"("organizationId", "emailId");

-- CreateIndex
CREATE INDEX "MailChecklistItem_organizationId_checked_idx" ON "MailChecklistItem"("organizationId", "checked");

-- CreateIndex
CREATE UNIQUE INDEX "MailChecklistItem_organizationId_id_key" ON "MailChecklistItem"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MailChecklistItem_organizationId_emailId_key_key" ON "MailChecklistItem"("organizationId", "emailId", "key");

-- CreateIndex
CREATE INDEX "EmailEvent_organizationId_emailId_type_idx" ON "EmailEvent"("organizationId", "emailId", "type");

-- CreateIndex
CREATE INDEX "EmailEvent_organizationId_createdAt_idx" ON "EmailEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_organizationId_id_key" ON "EmailEvent"("organizationId", "id");

-- CreateIndex
CREATE INDEX "EmailReply_organizationId_emailId_idx" ON "EmailReply"("organizationId", "emailId");

-- CreateIndex
CREATE INDEX "EmailReply_organizationId_category_idx" ON "EmailReply"("organizationId", "category");

-- CreateIndex
CREATE INDEX "EmailReply_organizationId_receivedAt_idx" ON "EmailReply"("organizationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailReply_organizationId_id_key" ON "EmailReply"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailReply_organizationId_gmailMessageId_key" ON "EmailReply"("organizationId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "TrackedLink_organizationId_emailId_idx" ON "TrackedLink"("organizationId", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_organizationId_id_key" ON "TrackedLink"("organizationId", "id");

-- CreateIndex
CREATE INDEX "LinkClick_organizationId_linkId_idx" ON "LinkClick"("organizationId", "linkId");

-- CreateIndex
CREATE INDEX "LinkClick_organizationId_clickedAt_idx" ON "LinkClick"("organizationId", "clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkClick_organizationId_id_key" ON "LinkClick"("organizationId", "id");

-- CreateIndex
CREATE INDEX "MailAttachment_organizationId_emailId_idx" ON "MailAttachment"("organizationId", "emailId");

-- CreateIndex
CREATE INDEX "MailAttachment_organizationId_type_idx" ON "MailAttachment"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MailAttachment_organizationId_id_key" ON "MailAttachment"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AiGeneration_organizationId_type_idx" ON "AiGeneration"("organizationId", "type");

-- CreateIndex
CREATE INDEX "AiGeneration_organizationId_leadId_idx" ON "AiGeneration"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "AiGeneration_organizationId_emailId_idx" ON "AiGeneration"("organizationId", "emailId");

-- CreateIndex
CREATE INDEX "AiGeneration_organizationId_createdAt_idx" ON "AiGeneration"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiGeneration_organizationId_id_key" ON "AiGeneration"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AiUsageLedger_organizationId_provider_createdAt_status_idx" ON "AiUsageLedger"("organizationId", "provider", "createdAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageLedger_organizationId_id_key" ON "AiUsageLedger"("organizationId", "id");

-- CreateIndex
CREATE INDEX "LeadAnalysisRevision_organizationId_leadId_status_version_idx" ON "LeadAnalysisRevision"("organizationId", "leadId", "status", "version");

-- CreateIndex
CREATE INDEX "LeadAnalysisRevision_organizationId_projectId_idx" ON "LeadAnalysisRevision"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "LeadAnalysisRevision_organizationId_sourceGenerationId_idx" ON "LeadAnalysisRevision"("organizationId", "sourceGenerationId");

-- CreateIndex
CREATE INDEX "LeadAnalysisRevision_organizationId_changedById_idx" ON "LeadAnalysisRevision"("organizationId", "changedById");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAnalysisRevision_organizationId_id_key" ON "LeadAnalysisRevision"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAnalysisRevision_organizationId_leadId_version_key" ON "LeadAnalysisRevision"("organizationId", "leadId", "version");

-- CreateIndex
CREATE INDEX "Task_organizationId_status_dueAt_idx" ON "Task"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_leadId_idx" ON "Task"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "Task_organizationId_assigneeId_idx" ON "Task"("organizationId", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_organizationId_id_key" ON "Task"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_stage_updatedAt_idx" ON "Opportunity"("organizationId", "stage", "updatedAt");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_ownerId_stage_idx" ON "Opportunity"("organizationId", "ownerId", "stage");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_expectedCloseDate_idx" ON "Opportunity"("organizationId", "expectedCloseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_organizationId_id_key" ON "Opportunity"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_organizationId_leadId_key" ON "Opportunity"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "OpportunityStageHistory_organizationId_opportunityId_create_idx" ON "OpportunityStageHistory"("organizationId", "opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityStageHistory_organizationId_toStage_createdAt_idx" ON "OpportunityStageHistory"("organizationId", "toStage", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityStageHistory_organizationId_changedById_createdA_idx" ON "OpportunityStageHistory"("organizationId", "changedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityStageHistory_organizationId_id_key" ON "OpportunityStageHistory"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityStageHistory_organizationId_operationKey_key" ON "OpportunityStageHistory"("organizationId", "operationKey");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_action_idx" ON "AuditLog"("organizationId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_userId_createdAt_idx" ON "AuditLog"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_sessionId_createdAt_idx" ON "AuditLog"("organizationId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_action_createdAt_idx" ON "AuditLog"("organizationId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_organizationId_id_key" ON "AuditLog"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdfundingProject" ADD CONSTRAINT "CrowdfundingProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdfundingProject" ADD CONSTRAINT "CrowdfundingProject_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_organizationId_projectId_fkey" FOREIGN KEY ("organizationId", "projectId") REFERENCES "CrowdfundingProject"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "SalesLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "SalesLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_organizationId_contactId_fkey" FOREIGN KEY ("organizationId", "contactId") REFERENCES "ContactPerson"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_organizationId_approvedById_fkey" FOREIGN KEY ("organizationId", "approvedById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_organizationId_analysisRevisionId_fkey" FOREIGN KEY ("organizationId", "analysisRevisionId") REFERENCES "LeadAnalysisRevision"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailTemplate" ADD CONSTRAINT "MailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailChecklistItem" ADD CONSTRAINT "MailChecklistItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailChecklistItem" ADD CONSTRAINT "MailChecklistItem_organizationId_emailId_fkey" FOREIGN KEY ("organizationId", "emailId") REFERENCES "OutreachEmail"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_organizationId_emailId_fkey" FOREIGN KEY ("organizationId", "emailId") REFERENCES "OutreachEmail"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReply" ADD CONSTRAINT "EmailReply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReply" ADD CONSTRAINT "EmailReply_organizationId_emailId_fkey" FOREIGN KEY ("organizationId", "emailId") REFERENCES "OutreachEmail"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_organizationId_emailId_fkey" FOREIGN KEY ("organizationId", "emailId") REFERENCES "OutreachEmail"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_organizationId_linkId_fkey" FOREIGN KEY ("organizationId", "linkId") REFERENCES "TrackedLink"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_organizationId_emailId_fkey" FOREIGN KEY ("organizationId", "emailId") REFERENCES "OutreachEmail"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "SalesLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_organizationId_emailId_fkey" FOREIGN KEY ("organizationId", "emailId") REFERENCES "OutreachEmail"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLedger" ADD CONSTRAINT "AiUsageLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "SalesLead"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_organizationId_projectId_fkey" FOREIGN KEY ("organizationId", "projectId") REFERENCES "CrowdfundingProject"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_organizationId_sourceGenerationId_fkey" FOREIGN KEY ("organizationId", "sourceGenerationId") REFERENCES "AiGeneration"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_organizationId_changedById_fkey" FOREIGN KEY ("organizationId", "changedById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "SalesLead"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_assigneeId_fkey" FOREIGN KEY ("organizationId", "assigneeId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "SalesLead"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_ownerId_fkey" FOREIGN KEY ("organizationId", "ownerId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_organizationId_opportunityId_fkey" FOREIGN KEY ("organizationId", "opportunityId") REFERENCES "Opportunity"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_organizationId_changedById_fkey" FOREIGN KEY ("organizationId", "changedById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_sessionId_fkey" FOREIGN KEY ("organizationId", "sessionId") REFERENCES "UserSession"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
