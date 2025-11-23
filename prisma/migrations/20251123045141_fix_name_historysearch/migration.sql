/*
  Warnings:

  - You are about to drop the `searchhistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `searchhistory` DROP FOREIGN KEY `SearchHistory_userId_fkey`;

-- DropTable
DROP TABLE `searchhistory`;

-- CreateTable
CREATE TABLE `history_searches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `term` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `history_searches_userId_term_key`(`userId`, `term`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `history_searches` ADD CONSTRAINT `history_searches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
