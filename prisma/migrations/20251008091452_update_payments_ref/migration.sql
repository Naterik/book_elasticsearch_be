/*
  Warnings:

  - You are about to drop the column `referenceId` on the `payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payments` DROP COLUMN `referenceId`,
    ADD COLUMN `paymentRef` VARCHAR(191) NULL;
