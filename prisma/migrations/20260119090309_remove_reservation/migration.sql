/*
  Warnings:

  - You are about to drop the column `heldByUserId` on the `book_copy` table. All the data in the column will be lost.
  - You are about to drop the column `holdExpiryDate` on the `book_copy` table. All the data in the column will be lost.
  - You are about to drop the `reservations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `reservations` DROP FOREIGN KEY `reservations_bookId_fkey`;

-- DropForeignKey
ALTER TABLE `reservations` DROP FOREIGN KEY `reservations_userId_fkey`;

-- AlterTable
ALTER TABLE `book_copy` DROP COLUMN `heldByUserId`,
    DROP COLUMN `holdExpiryDate`;

-- DropTable
DROP TABLE `reservations`;
