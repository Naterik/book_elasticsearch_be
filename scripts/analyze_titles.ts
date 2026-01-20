
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function analyze() {
  const books = await prisma.book.findMany({
    select: { id: true, title: true }
  });

  const patterns = {
    htmlTags: /<[^>]*>/g,
    brackets: /\[\d+\]/g,
    specialChars: /[^a-zA-Z0-9\s\-_.,:'"()&]/g,
    weirdStarts: /^[^a-zA-Z0-9]/,
    tooShort: /^.{0,2}$/
  };

  const suspicious: any[] = [];

  for (const b of books) {
    let issue = "";
    if (patterns.htmlTags.test(b.title)) issue = "HTML Tags";
    else if (patterns.brackets.test(b.title)) issue = "Brackets [10]";
    else if (patterns.weirdStarts.test(b.title)) issue = "Weird Start";
    
    if (issue) {
      suspicious.push({ id: b.id, title: b.title, issue });
    }
  }

  console.log(`Analyzed ${books.length} books.`);
  console.log(`Found ${suspicious.length} suspicious titles.`);
  console.table(suspicious.slice(0, 20));
}

analyze();
