ALTER TABLE "SalesLead"
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactFormUrl" TEXT,
ADD COLUMN "siteMessageUrl" TEXT,
ADD COLUMN "contactMemo" TEXT,
ADD COLUMN "sendMethod" TEXT,
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN "brandWebsiteUrl" TEXT,
ADD COLUMN "instagramUrl" TEXT,
ADD COLUMN "tiktokUrl" TEXT,
ADD COLUMN "xUrl" TEXT,
ADD COLUMN "brandAnalysisMemo" TEXT,
ADD COLUMN "snsAnalysisMemo" TEXT;
