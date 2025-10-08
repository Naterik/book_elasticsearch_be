/*
  Warnings:

  - You are about to drop the column `fineAmount` on the `loans` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cardNumber]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `book_copy` ADD COLUMN `heldByUserId` INTEGER NULL,
    ADD COLUMN `holdExpiryDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `loans` DROP COLUMN `fineAmount`;

-- AlterTable
ALTER TABLE `users` MODIFY `cardNumber` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `fines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `loanId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `fines_loanId_key`(`loanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` INTEGER NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` VARCHAR(50) NOT NULL,
    `referenceId` INTEGER NULL,
    `userId` INTEGER NOT NULL,
    `fineId` INTEGER NULL,

    UNIQUE INDEX `payments_fineId_key`(`fineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_cardNumber_key` ON `users`(`cardNumber`);

-- AddForeignKey
ALTER TABLE `fines` ADD CONSTRAINT `fines_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fines` ADD CONSTRAINT `fines_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_fineId_fkey` FOREIGN KEY (`fineId`) REFERENCES `fines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
