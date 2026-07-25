-- Keep MailTemplate IDs client-generated, consistent with the Prisma schema
-- and the other application-owned UUID primary keys.
ALTER TABLE "MailTemplate" ALTER COLUMN "id" DROP DEFAULT;
