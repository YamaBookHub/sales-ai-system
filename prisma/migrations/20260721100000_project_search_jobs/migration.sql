-- Durable search jobs are owned by one active organization membership.
CREATE TYPE "ProjectSearchJobStatus" AS ENUM ('running', 'completed', 'cancelled', 'failed');

CREATE TABLE "ProjectSearchJob" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "ProjectSearchJobStatus" NOT NULL DEFAULT 'running',
    "source" "PlatformType" NOT NULL,
    "request" JSONB NOT NULL,
    "desiredLimit" INTEGER NOT NULL,
    "searchedLimit" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "importableCount" INTEGER NOT NULL DEFAULT 0,
    "diagnostics" JSONB,
    "completionReason" TEXT,
    "message" TEXT NOT NULL,
    "cancelRequestedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSearchJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectSearchJob_organizationId_id_key" ON "ProjectSearchJob"("organizationId", "id");
CREATE INDEX "ProjectSearchJob_organizationId_ownerUserId_updatedAt_idx" ON "ProjectSearchJob"("organizationId", "ownerUserId", "updatedAt");
CREATE INDEX "ProjectSearchJob_status_workerId_cancelRequestedAt_leaseExpiresAt_idx" ON "ProjectSearchJob"("status", "workerId", "cancelRequestedAt", "leaseExpiresAt");
CREATE INDEX "ProjectSearchJob_expiresAt_idx" ON "ProjectSearchJob"("expiresAt");

-- The repository cancels an older job before inserting its replacement. This
-- index also protects that invariant when concurrent requests race.
CREATE UNIQUE INDEX "ProjectSearchJob_one_running_owner_key"
ON "ProjectSearchJob"("organizationId", "ownerUserId")
WHERE "status" = 'running';

ALTER TABLE "ProjectSearchJob"
ADD CONSTRAINT "ProjectSearchJob_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectSearchJob"
ADD CONSTRAINT "ProjectSearchJob_organizationId_ownerUserId_fkey"
FOREIGN KEY ("organizationId", "ownerUserId")
REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
