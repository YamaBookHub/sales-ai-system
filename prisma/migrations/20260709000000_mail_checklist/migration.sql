-- CreateTable
CREATE TABLE "MailChecklistItem" (
    "id" UUID NOT NULL,
    "emailId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailChecklistItem_emailId_key_key" ON "MailChecklistItem"("emailId", "key");

-- CreateIndex
CREATE INDEX "MailChecklistItem_emailId_idx" ON "MailChecklistItem"("emailId");

-- CreateIndex
CREATE INDEX "MailChecklistItem_checked_idx" ON "MailChecklistItem"("checked");

-- AddForeignKey
ALTER TABLE "MailChecklistItem" ADD CONSTRAINT "MailChecklistItem_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutreachEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
