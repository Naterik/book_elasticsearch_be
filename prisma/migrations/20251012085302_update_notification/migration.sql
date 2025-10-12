/*
  Warnings:

  - Made the column `sentAt` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `notifications` MODIFY `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
