
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanNon13Isbns() {
  console.log("🧹 Scanning for ISBNs that are NOT 13 characters...");

  // Fetch all ISBNs (efficiently)
  const allBooks = await prisma.book.findMany({
    select: { id: true, isbn: true }
  });

  // Filter in memory (fastest for < 100k records)
  const invalidBooks = allBooks.filter(b => {
      const len = b.isbn.trim().length;
      return len !== 13;
  });

  if (invalidBooks.length === 0) {
      console.log("✅ All books have exactly 13-character ISBNs.");
      return;
  }

  console.log(`⚠️ Found ${invalidBooks.length} books with non-13-char ISBNs.`);
  // Show a few examples
  console.log("Examples:", invalidBooks.slice(0, 5).map(b => b.isbn).join(", "));
  
  const ids = invalidBooks.map(b => b.id);
  
  if (ids.length > 0) {
      console.log("🚀 Deleting...");

      // 1. Delete copies
      await prisma.bookcopy.deleteMany({
          where: { bookId: { in: ids } }
      });

      // 2. Delete digital versions
      await prisma.digitalBook.deleteMany({
          where: { bookId: { in: ids } }
      });
      
      // 3. Delete Genre Relations
      await prisma.booksOnGenres.deleteMany({
          where: { bookId: { in: ids } }
      });

      // 4. Delete books
      const result = await prisma.book.deleteMany({
          where: { id: { in: ids } }
      });

      console.log(`✅ Deleted ${result.count} books.`);
  }
}

cleanNon13Isbns()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
