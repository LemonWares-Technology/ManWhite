/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `GuestUser` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_email_key" ON "GuestUser"("email");
