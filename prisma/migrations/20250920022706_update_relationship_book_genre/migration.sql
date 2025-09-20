/*
  Warnings:

  - You are about to drop the `_booktogenre` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `_booktogenre` DROP FOREIGN KEY `_bookTogenre_A_fkey`;

-- DropForeignKey
ALTER TABLE `_booktogenre` DROP FOREIGN KEY `_bookTogenre_B_fkey`;

-- AlterTable
ALTER TABLE `books` MODIFY `quantity` INTEGER NOT NULL DEFAULT 1,
    MODIFY `image` MEDIUMTEXT NULL;

-- DropTable
DROP TABLE `_booktogenre`;

-- CreateTable
CREATE TABLE `BooksOnGenres` (
    `bookId` INTEGER NOT NULL,
    `genreId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`bookId`, `genreId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BooksOnGenres` ADD CONSTRAINT `BooksOnGenres_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BooksOnGenres` ADD CONSTRAINT `BooksOnGenres_genreId_fkey` FOREIGN KEY (`genreId`) REFERENCES `genres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
