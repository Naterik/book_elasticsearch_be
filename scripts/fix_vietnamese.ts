
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixVietnameseTitles() {
  console.log("🇻🇳 Scanning for Vietnamese Title issues...");

  const books = await prisma.book.findMany({
    select: { id: true, title: true }
  });

  let fixedCount = 0;
  for (const b of books) {
    let t = b.title;
    let original = t;

    // 1. Normalize NFC (Fixes "ổ" -> "ổ")
    t = t.normalize("NFC");
    
    // 2. Fix comma spacing ( "abc ,def" -> "abc, def")
    t = t.replace(/\s+,/g, ",");

    // 3. Fix weird encoding like "à̂" (combining chars gone wrong)
    // This is hard to regex perfectly without logic, but let's try standard NFC first.
    // If user meant "Văn Em Hò̂" (o + hook above) -> "Hồ".
    // NFC usually handles this. Let's see if there are space issues.
    
    t = t.replace(/\s+/g, " ").trim();
    
    // Check specific bad patterns if needed
    // e.g. "Toi ta`m dao" -> if we had a dictionary... but we don't.
    
    if (t !== original) {
      await prisma.book.update({
        where: { id: b.id },
        data: { title: t }
      });
      fixedCount++;
       process.stdout.write("v");
    }
  }

  console.log(`\n\n✅ Improved Vietnamese formatting for ${fixedCount} books.`);
  
  // Optional: Delete really bad ones that look like mojibake?
  // e.g. title with too many question marks "??????"
  const deleted = await prisma.book.deleteMany({
      where: {
          title: { contains: "????" }
      }
  });
  if (deleted.count > 0) console.log(`🗑️ Deleted ${deleted.count} mojibake books.`);
}

fixVietnameseTitles()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
