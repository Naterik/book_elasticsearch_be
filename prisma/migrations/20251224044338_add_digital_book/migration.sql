-- CreateTable
CREATE TABLE `digital_books` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookId` INTEGER NOT NULL,
    `filePath` VARCHAR(500) NOT NULL,
    `fileType` VARCHAR(10) NOT NULL DEFAULT 'PDF',
    `fileSize` BIGINT NOT NULL,
    `isPreview` BOOLEAN NOT NULL DEFAULT true,
    `pageCount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `digital_books_bookId_key`(`bookId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `digital_books` ADD CONSTRAINT `digital_books_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
