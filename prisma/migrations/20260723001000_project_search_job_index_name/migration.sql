-- PostgreSQL truncated the original generated name at 63 bytes. Give the
-- index an explicit stable name that also matches the Prisma schema mapping.
ALTER INDEX "ProjectSearchJob_status_workerId_cancelRequestedAt_leaseExpires"
RENAME TO "ProjectSearchJob_status_workerId_cancelRequestedAt_leaseExp_idx";
