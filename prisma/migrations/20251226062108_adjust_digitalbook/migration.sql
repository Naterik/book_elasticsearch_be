/*
  Warnings:

  - You are about to drop the column `createdAt` on the `digital_books` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `digital_books` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `digital_books` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `digital_books` table. All the data in the column will be lost.
  - You are about to drop the column `isPreview` on the `digital_books` table. All the data in the column will be lost.
  - You are about to drop the column `pageCount` on the `digital_books` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `digital_books` DROP FOREIGN KEY `digital_books_bookId_fkey`;

-- AlterTable
ALTER TABLE `digital_books` DROP COLUMN `createdAt`,
    DROP COLUMN `filePath`,
    DROP COLUMN `fileSize`,
    DROP COLUMN `fileType`,
    DROP COLUMN `isPreview`,
    DROP COLUMN `pageCount`,
    ADD COLUMN `previewUrl` TEXT NULL,
    ADD COLUMN `status` ENUM('NO_VIEW', 'FULL', 'RESTRICTED') NOT NULL DEFAULT 'NO_VIEW';

-- AddForeignKey
ALTER TABLE `digital_books` ADD CONSTRAINT `digital_books_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
