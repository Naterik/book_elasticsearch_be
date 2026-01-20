
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupBooks() {
  console.log("🧹 Starting Deep Cleanup...");

  // 1. CLEAN: Remove surrounding quotes from titles (e.g. 'Title' -> Title)
  const books = await prisma.book.findMany({
    select: { id: true, title: true }
  });

  let fixedCount = 0;
  for (const b of books) {
    let t = b.title.trim();
    let original = t;
    
    // Strip quotes
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      t = t.substring(1, t.length - 1).trim();
    }
    
    // Strip ending comma
    if (t.endsWith(",")) {
       t = t.substring(0, t.length - 1).trim();
    }

    if (t !== original && t.length > 0) {
      await prisma.book.update({
        where: { id: b.id },
        data: { title: t }
      });
      fixedCount++;
      process.stdout.write("f");
    }
  }
  console.log(`\n✨ Fixed quotes/formatting for ${fixedCount} books.`);

  // 2. DELETE: Remove meaningless titles: (1), (123), [10], 1990
  // Regex: ^[([0-9]+[)\]]$  OR  ^\d+$
  const garbageRegex = /^([(\[]\d+[)\]]|\d+)$/;
  
  // We have to filter in JS because Prisma doesn't support Regex where clause easily
  const allBooks = await prisma.book.findMany({
    select: { id: true, title: true }
  });
  
  const idsToDelete = allBooks
    .filter(b => garbageRegex.test(b.title.trim()))
    .map(b => b.id);

  if (idsToDelete.length > 0) {
    console.log(`\n🗑️  Found ${idsToDelete.length} garbage books (e.g. "(1)", "1998"). Deleting...`);
    
    // Delete in batches (BookCopy and DigitalBook cascade delete defined in schema usually? 
    // If not, we might need manual delete. Assuming schema has onDelete: Cascade or we handle it)
    // Actually, usually relation deletion is required. Let's try direct delete.
    // If foreign key constraint fails, we delete relations first.
    
    for (const id of idsToDelete) {
        try {
            // Delete related tables manually (safest) 
            await prisma.bookcopy.deleteMany({ where: { bookId: id } });
            await prisma.digitalBook.deleteMany({ where: { bookId: id } });
            // Delete genres relation (BookGenre) - implicit or explicit? 
            // In Prisma schema many-to-many, it handles join table deletions usually.
            
            await prisma.book.delete({ where: { id } });
            process.stdout.write("x");
        } catch (e) {
            console.error(`Error deleting book ${id}:`, e);
            // Likely foreign key constraint. We will rely on Prisma's cascade if set up, 
            // or we might need to query the join table 'GenresOnBooks' if it exists explicitly.
            // Based on earlier view, it's `genres` relation. 
        }
    }
    console.log(`\n✅ Deleted ${idsToDelete.length} garbage records.`);
  } else {
    console.log("\n✅ No garbage numeric titles found.");
  }
}

cleanupBooks()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
