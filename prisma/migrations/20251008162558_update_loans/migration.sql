/*
  Warnings:

  - Made the column `loanDate` on table `loans` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `loans` ADD COLUMN `renewalCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `loanDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
