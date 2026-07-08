-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('campfire', 'makuake', 'green_funding', 'other');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('discovered', 'active', 'ended', 'suspended', 'unknown');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('discovered', 'qualified', 'drafted', 'reviewing', 'approved', 'queued', 'contacted', 'replied', 'meeting_candidate', 'rejected', 'no_response', 'archived');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('draft', 'in_review', 'approved', 'queued', 'sending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('created', 'generated', 'reviewed', 'approved', 'queued', 'sending', 'sent', 'failed', 'retried', 'opened', 'clicked', 'replied', 'unsubscribed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReplyCategory" AS ENUM ('interested', 'need_info', 'meeting_request', 'not_interested', 'unsubscribe', 'auto_reply', 'complaint', 'unknown');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'doing', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "AiGenerationType" AS ENUM ('lead_scoring', 'email_draft', 'subject_generation', 'reply_classification', 'project_summary', 'next_action');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('proposal_pdf', 'lp_url', 'video_url', 'case_study_url', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrowdfundingPlatform" (
    "id" UUID NOT NULL,
    "type" "PlatformType" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrowdfundingPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "websiteUrl" TEXT,
    "inquiryUrl" TEXT,
    "industry" TEXT,
    "memo" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPerson" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "inquiryUrl" TEXT,
    "roleTitle" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isUnsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrowdfundingProject" (
    "id" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "companyId" UUID,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'unknown',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "supporterCount" INTEGER NOT NULL DEFAULT 0,
    "targetAmount" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "category" TEXT,
    "thumbnailUrl" TEXT,
    "scrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CrowdfundingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLead" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID,
    "status" "LeadStatus" NOT NULL DEFAULT 'discovered',
    "priority" "LeadPriority" NOT NULL DEFAULT 'medium',
    "score" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "ownerMemo" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScore" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "amountScore" INTEGER NOT NULL DEFAULT 0,
    "supporterScore" INTEGER NOT NULL DEFAULT 0,
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "activityScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "reasonJson" JSONB,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmail" (
    "id" UUID NOT NULL,
    "leadId" UUID,
    "companyId" UUID NOT NULL,
    "contactId" UUID,
    "approvedById" UUID,
    "status" "EmailStatus" NOT NULL DEFAULT 'draft',
    "templateKey" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "toEmail" TEXT,
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" UUID NOT NULL,
    "emailId" UUID NOT NULL,
    "type" "EmailEventType" NOT NULL,
    "payload" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailReply" (
    "id" UUID NOT NULL,
    "emailId" UUID NOT NULL,
    "gmailMessageId" TEXT,
    "fromEmail" TEXT,
    "body" TEXT NOT NULL,
    "bodyText" TEXT,
    "category" "ReplyCategory" NOT NULL DEFAULT 'unknown',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT,
    "nextAction" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedLink" (
    "id" UUID NOT NULL,
    "emailId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" UUID NOT NULL,
    "linkId" UUID NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAttachment" (
    "id" UUID NOT NULL,
    "emailId" UUID NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" UUID NOT NULL,
    "leadId" UUID,
    "emailId" UUID,
    "type" "AiGenerationType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    "latencyMs" INTEGER,
    "tokenInput" INTEGER,
    "tokenOutput" INTEGER,
    "costUsd" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "leadId" UUID,
    "assigneeId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdfundingPlatform_type_baseUrl_key" ON "CrowdfundingPlatform"("type", "baseUrl");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_normalizedName_idx" ON "Company"("normalizedName");

-- CreateIndex
CREATE INDEX "Company_isBlocked_idx" ON "Company"("isBlocked");

-- CreateIndex
CREATE INDEX "ContactPerson_companyId_idx" ON "ContactPerson"("companyId");

-- CreateIndex
CREATE INDEX "ContactPerson_email_idx" ON "ContactPerson"("email");

-- CreateIndex
CREATE INDEX "ContactPerson_isUnsubscribed_idx" ON "ContactPerson"("isUnsubscribed");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdfundingProject_url_key" ON "CrowdfundingProject"("url");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_platformId_idx" ON "CrowdfundingProject"("platformId");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_companyId_idx" ON "CrowdfundingProject"("companyId");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_status_idx" ON "CrowdfundingProject"("status");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_amount_supporterCount_idx" ON "CrowdfundingProject"("amount", "supporterCount");

-- CreateIndex
CREATE INDEX "CrowdfundingProject_endDate_idx" ON "CrowdfundingProject"("endDate");

-- CreateIndex
CREATE INDEX "SalesLead_status_priority_idx" ON "SalesLead"("status", "priority");

-- CreateIndex
CREATE INDEX "SalesLead_score_idx" ON "SalesLead"("score");

-- CreateIndex
CREATE INDEX "SalesLead_nextActionAt_idx" ON "SalesLead"("nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_companyId_projectId_key" ON "SalesLead"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "LeadScore_leadId_idx" ON "LeadScore"("leadId");

-- CreateIndex
CREATE INDEX "LeadScore_totalScore_idx" ON "LeadScore"("totalScore");

-- CreateIndex
CREATE INDEX "OutreachEmail_status_idx" ON "OutreachEmail"("status");

-- CreateIndex
CREATE INDEX "OutreachEmail_leadId_idx" ON "OutreachEmail"("leadId");

-- CreateIndex
CREATE INDEX "OutreachEmail_companyId_idx" ON "OutreachEmail"("companyId");

-- CreateIndex
CREATE INDEX "OutreachEmail_gmailThreadId_idx" ON "OutreachEmail"("gmailThreadId");

-- CreateIndex
CREATE INDEX "OutreachEmail_scheduledAt_idx" ON "OutreachEmail"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailEvent_emailId_type_idx" ON "EmailEvent"("emailId", "type");

-- CreateIndex
CREATE INDEX "EmailEvent_createdAt_idx" ON "EmailEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailReply_gmailMessageId_key" ON "EmailReply"("gmailMessageId");

-- CreateIndex
CREATE INDEX "EmailReply_emailId_idx" ON "EmailReply"("emailId");

-- CreateIndex
CREATE INDEX "EmailReply_category_idx" ON "EmailReply"("category");

-- CreateIndex
CREATE INDEX "EmailReply_receivedAt_idx" ON "EmailReply"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_token_key" ON "TrackedLink"("token");

-- CreateIndex
CREATE INDEX "TrackedLink_emailId_idx" ON "TrackedLink"("emailId");

-- CreateIndex
CREATE INDEX "LinkClick_linkId_idx" ON "LinkClick"("linkId");

-- CreateIndex
CREATE INDEX "LinkClick_clickedAt_idx" ON "LinkClick"("clickedAt");

-- CreateIndex
CREATE INDEX "MailAttachment_emailId_idx" ON "MailAttachment"("emailId");

-- CreateIndex
CREATE INDEX "MailAttachment_type_idx" ON "MailAttachment"("type");

-- CreateIndex
CREATE INDEX "AiGeneration_type_idx" ON "AiGeneration"("type");

-- CreateIndex
CREATE INDEX "AiGeneration_leadId_idx" ON "AiGeneration"("leadId");

-- CreateIndex
CREATE INDEX "AiGeneration_emailId_idx" ON "AiGeneration"("emailId");

-- CreateIndex
CREATE INDEX "AiGeneration_createdAt_idx" ON "AiGeneration"("createdAt");

-- CreateIndex
CREATE INDEX "Task_status_dueAt_idx" ON "Task"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdfundingProject" ADD CONSTRAINT "CrowdfundingProject_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "CrowdfundingPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdfundingProject" ADD CONSTRAINT "CrowdfundingProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CrowdfundingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReply" ADD CONSTRAINT "EmailReply_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TrackedLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

