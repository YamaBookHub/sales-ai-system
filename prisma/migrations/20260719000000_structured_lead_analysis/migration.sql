CREATE TYPE "LeadAnalysisStatus" AS ENUM ('draft', 'confirmed');
CREATE TYPE "LeadAnalysisOrigin" AS ENUM ('generated', 'manual', 'migration');

CREATE TABLE "LeadAnalysisRevision" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sourceGenerationId" UUID,
    "changedById" UUID,
    "version" INTEGER NOT NULL,
    "status" "LeadAnalysisStatus" NOT NULL DEFAULT 'draft',
    "origin" "LeadAnalysisOrigin" NOT NULL,
    "appeal" TEXT,
    "targetUser" TEXT,
    "videoIdea" TEXT,
    "sourceFingerprint" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "humanEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadAnalysisRevision_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OutreachEmail" ADD COLUMN "analysisRevisionId" UUID;

-- Historical AI output becomes an unconfirmed proposal only. Existing mail stays unlinked.
WITH latest_generation AS (
    SELECT DISTINCT ON (generation."leadId")
        generation."id",
        generation."leadId",
        generation."outputJson",
        generation."createdAt",
        lead."projectId"
    FROM "AiGeneration" AS generation
    JOIN "SalesLead" AS lead ON lead."id" = generation."leadId"
    WHERE generation."type" = 'project_summary'
      AND generation."leadId" IS NOT NULL
      AND lead."projectId" IS NOT NULL
    ORDER BY generation."leadId", generation."createdAt" DESC, generation."id" DESC
)
INSERT INTO "LeadAnalysisRevision" (
    "id", "leadId", "projectId", "sourceGenerationId", "version", "status", "origin",
    "appeal", "targetUser", "videoIdea", "sourceFingerprint", "generatedAt",
    "humanEdited", "editedFields", "createdAt"
)
SELECT
    md5(latest."id"::text || ':structured-lead-analysis')::uuid,
    latest."leadId",
    latest."projectId",
    latest."id",
    1,
    'draft'::"LeadAnalysisStatus",
    'migration'::"LeadAnalysisOrigin",
    NULLIF(BTRIM(latest."outputJson"->'mailPlaceholders'->>'appeal'), ''),
    NULLIF(BTRIM(latest."outputJson"->'mailPlaceholders'->>'targetUser'), ''),
    COALESCE(
        NULLIF(BTRIM(latest."outputJson"->'mailPlaceholders'->>'videoIdea'), ''),
        NULLIF(BTRIM(latest."outputJson"->'snsIdeas'->>0), '')
    ),
    md5(concat_ws(chr(31), project."id"::text, project."title", project."url", COALESCE(project."category", ''), COALESCE(project."description", ''))),
    latest."createdAt",
    false,
    ARRAY[]::TEXT[],
    latest."createdAt"
FROM latest_generation AS latest
JOIN "CrowdfundingProject" AS project ON project."id" = latest."projectId";

CREATE UNIQUE INDEX "LeadAnalysisRevision_leadId_version_key" ON "LeadAnalysisRevision"("leadId", "version");
CREATE INDEX "LeadAnalysisRevision_leadId_status_version_idx" ON "LeadAnalysisRevision"("leadId", "status", "version");
CREATE INDEX "LeadAnalysisRevision_projectId_idx" ON "LeadAnalysisRevision"("projectId");
CREATE INDEX "LeadAnalysisRevision_sourceGenerationId_idx" ON "LeadAnalysisRevision"("sourceGenerationId");
CREATE INDEX "LeadAnalysisRevision_changedById_idx" ON "LeadAnalysisRevision"("changedById");
CREATE INDEX "OutreachEmail_analysisRevisionId_idx" ON "OutreachEmail"("analysisRevisionId");

ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CrowdfundingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_sourceGenerationId_fkey" FOREIGN KEY ("sourceGenerationId") REFERENCES "AiGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadAnalysisRevision" ADD CONSTRAINT "LeadAnalysisRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_analysisRevisionId_fkey" FOREIGN KEY ("analysisRevisionId") REFERENCES "LeadAnalysisRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
