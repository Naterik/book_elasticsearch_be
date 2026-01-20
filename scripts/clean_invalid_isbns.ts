
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanInvalidIsbns() {
  console.log("🧹 Scanning for invalid ISBNs (OL- prefix)...");

  // Find books with Internal OpenLibrary IDs (not real ISBNs)
  const books = await prisma.book.findMany({
    where: {
        isbn: { startsWith: "OL-" }
    },
    select: { id: true, isbn: true, title: true }
  });

  if (books.length === 0) {
      console.log("✅ No invalid 'OL-' ISBNs found.");
      return;
  }

  console.log(`⚠️ Found ${books.length} books with internal IDs (cannot be searched on web).`);
  console.table(books.slice(0, 10)); // Preview

  console.log("🚀 Deleting...");
  
  // Batch delete
  // We need to loop to handle potential relation constraints individually or just deleteMany if cascade is on.
  // We'll trust Prisma relations or do it in order.
  
  const ids = books.map(b => b.id);
  
  // 1. Delete copies
  await prisma.bookcopy.deleteMany({
      where: { bookId: { in: ids } }
  });

  // 2. Delete digital versions
  await prisma.digitalBook.deleteMany({
      where: { bookId: { in: ids } }
  });
  
  // 3. Delete Genre Relations (The Join Table)
  // Check schema: model BooksOnGenres
  await prisma.booksOnGenres.deleteMany({
      where: { bookId: { in: ids } }
  });

  // 4. Delete books
  const result = await prisma.book.deleteMany({
      where: { id: { in: ids } }
  });

  console.log(`✅ Deleted ${result.count} books with invalid ISBNs.`);
}

cleanInvalidIsbns()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
