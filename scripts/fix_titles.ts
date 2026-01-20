
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Copy of cleanBookTitle logic for standalone script
 */
function cleanBookTitle(rawTitle: string): string {
    if (!rawTitle) return "";
    let t = rawTitle;

    // 1. Remove HTML tags
    t = t.replace(/<[^>]*>/g, "");

    // 2. Remove common noisy suffixes like " / by Author Name"
    t = t.replace(/\s\/\s+by\s+.*$/i, "");

    // 3. Remove brackets like [1], [10] often used for series index
    t = t.replace(/\s\[\d+\]/g, "");

    // 4. Remove start/end non-word chars (except common ones)
    // Keep standard start chars (A-Z, 0-9, " ' () )
    t = t.replace(/^[^a-zA-Z0-9"'(]+/, ""); 
    
    // 5. Compress spaces
    t = t.replace(/\s+/g, " ").trim();

    return t;
}

async function fixTitles() {
  console.log("🔍 Scanning for bad titles...");
  
  const books = await prisma.book.findMany({
    select: { id: true, title: true }
  });

  const updates: any[] = [];

  for (const b of books) {
    const cleaned = cleanBookTitle(b.title);
    if (cleaned !== b.title && cleaned.length >= 2) {
        updates.push({
            id: b.id,
            old: b.title,
            new: cleaned
        });
    }
  }

  if (updates.length === 0) {
    console.log("✅ No titles need fixing!");
    return;
  }

  console.log(`⚠️ Found ${updates.length} titles to fix.`);
  console.table(updates.slice(0, 20)); // Show preview

  // Execute Updates
  console.log("🚀 Applying fixes...");
  let successCount = 0;

  for (const item of updates) {
      try {
          await prisma.book.update({
              where: { id: item.id },
              data: { title: item.new }
          });
          successCount++;
          process.stdout.write("."); // Progress dot
      } catch (e) {
          console.error(`\nFailed to update ID ${item.id}:`, e);
      }
  }

  console.log(`\n\n✅ Finished! Fixed ${successCount} titles.`);
}

fixTitles()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
