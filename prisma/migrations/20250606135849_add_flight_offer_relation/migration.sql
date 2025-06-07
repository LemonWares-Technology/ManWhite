/*
  Warnings:

  - Added the required column `updatedAt` to the `FlightCart` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FlightCart" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Traveler" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "flightOfferId" TEXT;

-- CreateTable
CREATE TABLE "FlightOffer" (
    "id" TEXT NOT NULL,
    "offerData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Traveler_flightOfferId_idx" ON "Traveler"("flightOfferId");

-- AddForeignKey
ALTER TABLE "Traveler" ADD CONSTRAINT "Traveler_flightOfferId_fkey" FOREIGN KEY ("flightOfferId") REFERENCES "FlightOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
