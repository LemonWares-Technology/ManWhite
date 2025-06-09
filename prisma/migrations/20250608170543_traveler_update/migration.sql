-- AlterTable
ALTER TABLE "Traveler" ADD COLUMN     "guestUserId" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Traveler_userId_idx" ON "Traveler"("userId");

-- CreateIndex
CREATE INDEX "Traveler_guestUserId_idx" ON "Traveler"("guestUserId");
