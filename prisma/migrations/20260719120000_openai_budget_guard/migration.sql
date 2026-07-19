CREATE TYPE "AiUsageStatus" AS ENUM ('reserved', 'completed', 'failed');

CREATE TABLE "AiUsageLedger" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "AiUsageStatus" NOT NULL DEFAULT 'reserved',
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL,
    "actualCostUsd" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AiUsageLedger_pkey" PRIMARY KEY ("id")
);

-- Preserve OpenAI cost already recorded before the budget ledger was introduced.
INSERT INTO "AiUsageLedger" (
    "id", "provider", "model", "operation", "status",
    "estimatedCostUsd", "actualCostUsd", "createdAt", "completedAt"
)
SELECT
    md5(generation."id"::text || ':openai-budget-ledger')::uuid,
    'openai',
    generation."model",
    generation."promptVersion",
    'completed'::"AiUsageStatus",
    CASE WHEN generation."costUsd" > 0 THEN generation."costUsd" ELSE 0.01 END,
    CASE WHEN generation."costUsd" > 0 THEN generation."costUsd" ELSE 0.01 END,
    generation."createdAt",
    generation."createdAt"
FROM "AiGeneration" AS generation
WHERE generation."provider" = 'openai'
  AND generation."costUsd" IS NOT NULL;

CREATE INDEX "AiUsageLedger_provider_createdAt_status_idx"
ON "AiUsageLedger"("provider", "createdAt", "status");
