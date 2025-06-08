-- AlterTable
ALTER TABLE "FlightAddon" ADD COLUMN     "flightOfferId" TEXT;

-- CreateIndex
CREATE INDEX "FlightAddon_flightOfferId_idx" ON "FlightAddon"("flightOfferId");

-- AddForeignKey
ALTER TABLE "FlightAddon" ADD CONSTRAINT "FlightAddon_flightOfferId_fkey" FOREIGN KEY ("flightOfferId") REFERENCES "FlightOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
