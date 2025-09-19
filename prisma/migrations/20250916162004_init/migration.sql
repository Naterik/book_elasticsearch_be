-- CreateTable
CREATE TABLE `authors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `bio` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `books` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isbn` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `shortDesc` VARCHAR(255) NOT NULL,
    `detailDesc` MEDIUMTEXT NOT NULL,
    `price` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `publishDate` DATETIME(3) NULL,
    `image` MEDIUMTEXT NOT NULL,
    `language` VARCHAR(20) NULL,
    `pages` INTEGER NOT NULL,
    `borrowed` INTEGER NOT NULL DEFAULT 0,
    `authorId` INTEGER NOT NULL,
    `publisherId` INTEGER NOT NULL,

    UNIQUE INDEX `Book_isbn_key`(`isbn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book_copy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year_published` YEAR NOT NULL,
    `copyNumber` INTEGER NOT NULL,
    `bookId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `genres` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loanDate` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `returnDate` DATETIME(3) NULL,
    `status` VARCHAR(255) NOT NULL,
    `fineAmount` INTEGER NULL,
    `bookcopyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sentAt` DATETIME(3) NULL,
    `type` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publishers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestDate` DATETIME(3) NULL,
    `status` VARCHAR(255) NOT NULL,
    `bookId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `description` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `fullName` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(255) NULL,
    `avatar` VARCHAR(255) NULL,
    `cardNumber` INTEGER NULL,
    `membershipStart` DATETIME(3) NULL,
    `membershipEnd` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `roleId` INTEGER NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_bookTogenre` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_bookTogenre_AB_unique`(`A`, `B`),
    INDEX `_bookTogenre_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `books` ADD CONSTRAINT `books_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `books` ADD CONSTRAINT `books_publisherId_fkey` FOREIGN KEY (`publisherId`) REFERENCES `publishers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_copy` ADD CONSTRAINT `book_copy_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_bookcopyId_fkey` FOREIGN KEY (`bookcopyId`) REFERENCES `book_copy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_bookTogenre` ADD CONSTRAINT `_bookTogenre_A_fkey` FOREIGN KEY (`A`) REFERENCES `books`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_bookTogenre` ADD CONSTRAINT `_bookTogenre_B_fkey` FOREIGN KEY (`B`) REFERENCES `genres`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
