
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 TESTING INVENTORY CONSISTENCY CHECK...");

  // 1. Setup: Find a book to mess with
  const book = await prisma.book.findFirst({
    include: { bookCopies: true }
  });

  if (!book) {
    console.log("❌ No books found to test.");
    return;
  }

  const realCount = await prisma.bookcopy.count({
    where: { bookId: book.id, status: { not: "LOST" } }
  });

  console.log(`📘 Target Book: [${book.id}] ${book.title}`);
  console.log(`   Real Physical Copies: ${realCount}`);
  console.log(`   Current Catalog Qty:  ${book.quantity}`);

  // 2. Modify Quantity to create a discrepancy (Simulate Error)
  console.log("\n⚠️  Simulating DATA ERROR: Manually changing quantity to 9999...");
  await prisma.book.update({
    where: { id: book.id },
    data: { quantity: 9999 }
  });

  // 3. Run the Check Logic (Imitating the Controller)
  console.log("\n🕵️  Running Check Logic...");
  
  const booksToCheck = await prisma.book.findMany({ select: { id: true, title: true, quantity: true } });
  const discrepancies = [];

  for (const b of booksToCheck) {
    const actual = await prisma.bookcopy.count({
        where: { bookId: b.id, status: { not: "LOST" } }
    });
    
    if (b.quantity !== actual) {
        discrepancies.push({
            bookId: b.id,
            title: b.title,
            catalogQuantity: b.quantity,
            realPhysicalCount: actual,
            status: "MISMATCH"
        });
    }
  }

  // 4. Report Results
  if (discrepancies.length > 0) {
      console.log(`🚩 FOUND ${discrepancies.length} DISCREPANCIES!`);
      console.table(discrepancies);
  } else {
      console.log("✅ No discrepancies found.");
  }

  // 5. Cleanup / Sync Back
  console.log("\n🔄 Syncing back to reality...");
  await prisma.book.update({
      where: { id: book.id },
      data: { quantity: realCount }
  });
  console.log("✅ Restored original quantity.");

}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
