/*
  Warnings:

  - Added the required column `location` to the `book_copy` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `book_copy` ADD COLUMN `location` VARCHAR(255) NOT NULL,
    ADD COLUMN `status` VARCHAR(25) NOT NULL DEFAULT 'AVAILABLE',
    MODIFY `copyNumber` VARCHAR(25) NOT NULL;
