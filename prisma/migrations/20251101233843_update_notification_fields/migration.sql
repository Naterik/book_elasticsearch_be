-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_userId_fkey`;

-- DropIndex
DROP INDEX `notifications_userId_fkey` ON `notifications`;

-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `priority` VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `title` VARCHAR(255) NOT NULL DEFAULT 'Notification',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `notifications_userId_isRead_idx` ON `notifications`(`userId`, `isRead`);

-- CreateIndex
CREATE INDEX `notifications_sentAt_idx` ON `notifications`(`sentAt`);

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
