/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `authors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `genres` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `publishers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `authors_name_key` ON `authors`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `genres_name_key` ON `genres`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `publishers_name_key` ON `publishers`(`name`);

-- RenameIndex
ALTER TABLE `_booktogenre` RENAME INDEX `_bookTogenre_AB_unique` TO `_BookToGenre_AB_unique`;

-- RenameIndex
ALTER TABLE `_booktogenre` RENAME INDEX `_bookTogenre_B_index` TO `_BookToGenre_B_index`;
