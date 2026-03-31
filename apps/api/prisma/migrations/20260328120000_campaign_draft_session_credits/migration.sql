-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "sessionId" TEXT;

CREATE INDEX "Campaign_sessionId_idx" ON "Campaign"("sessionId");

ALTER TABLE "Campaign" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN "videoCredits" INTEGER NOT NULL DEFAULT 1;
