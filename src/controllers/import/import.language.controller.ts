import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";
import {
  ensureAuthor,
  ensureGenres,
  ensurePublisher,
  ensureShortDesc,
  getJSON,
  pickText,
  requestCache
} from "./import.helpers";

// ================= PROCESS HELPERS =================
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearCache() {
  requestCache.authors.clear();
  requestCache.publishers.clear();
  requestCache.genres.clear();
}

// ================= PROCESS WORK (Language Specific) =================
// Checks for specific language edition or title validity
async function processWork(workId: string, targetLanguage: string = "vie") {
  try {
    const workUrl = `https://openlibrary.org/works/${workId}.json`;
    const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=50`;

    const [workData, edsData] = await Promise.all([getJSON(workUrl), getJSON(edsUrl)]);
    const entries = edsData.entries || [];
    if (entries.length === 0) throw new Error("No editions found");

    const langKey = `/languages/${targetLanguage}`;
    // Find edition matching language
    let edition = entries.find((e: any) => e.languages?.some((l: any) => l.key === langKey));
    
    // Fallback: If no explicit language, check if title *looks* okay? 
    // The original code had `isValidVietnameseTitle` check for everything if target was vietnam.
    // For generic language, we might just strict check language key?
    // The original code checked `isValidVietnameseTitle` in fallback. 
    // Since we are generalizing, if target is NOT 'vie', we rely on language key.
    // If target IS 'vie', we might want that check, but `import.vietnamese.controller.ts` is redundant?
    // Actually `importBooksByLanguage` allows 'vie'.
    // Let's stick to language key for safety in generic importer.
    
    if (!edition) {
         // If generic, we can't guess title validity easily.
         throw new Error(`No edition found for language ${targetLanguage}`);
    }

    const title = edition.title || workData.title || "Untitled";
    
    // Author
    let authorName = "Unknown Author";
    let authorBio = "";
    const authorKey = workData.authors?.[0]?.author?.key;
    if (authorKey) {
        try {
            const authorData = await getJSON(`https://openlibrary.org/authors/${authorKey.split("/").pop()}.json`);
            authorName = authorData.name || authorName;
            authorBio = pickText(authorData.bio);
            if (authorBio.length > 60000) authorBio = authorBio.substring(0, 60000) + "...";
        } catch (e) {}
    }

    const isbn = (edition.isbn_13?.[0] || edition.isbn_10?.[0] || `OL-${workId}`).trim();
    if (await prisma.book.findUnique({ where: { isbn } })) {
        return { status: "fulfilled", value: { data: null, note: "Already exists" } };
    }

    const descRaw = pickText(workData.description) || pickText(edition.description) || "No description available.";
    const [authorId, publisherId, genreIds] = await Promise.all([
      ensureAuthor(authorName, authorBio),
      ensurePublisher(edition.publishers?.[0]),
      ensureGenres(workData.subjects || []),
    ]);

    const price = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
    const quantity = 5;
    const validDate = edition.publish_date ? new Date(edition.publish_date) : new Date();
    if (isNaN(validDate.getTime())) validDate.setTime(Date.now());

    // Map language code to Name?
    // Simple map
    const languageMap: Record<string, string> = {
        vie: "Vietnamese", eng: "English", fre: "French", ger: "German", spa: "Spanish",
        chi: "Chinese", jpn: "Japanese", kor: "Korean", rus: "Russian"
    };
    const displayLang = languageMap[targetLanguage] || targetLanguage;

    const newBook = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          isbn,
          title,
          shortDesc: ensureShortDesc(descRaw),
          detailDesc: descRaw,
          price,
          quantity,
          publishDate: validDate,
          image: edition.covers?.[0] ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg` : null,
          language: displayLang,
          pages: edition.number_of_pages || 0,
          authors: { connect: { id: authorId } },
          publishers: { connect: { id: publisherId } },
          genres: { create: genreIds.map((gid) => ({ genreId: gid })) },
        },
      });
      const copies = Array.from({length: quantity}, (_, i) => ({
          bookId: book.id,
          year_published: validDate.getFullYear(),
          copyNumber: `CP-${book.id}-${i+1}`,
          status: "AVAILABLE"
      }));
      await tx.bookcopy.createMany({ data: copies });
      return book;
    });

    return { status: "fulfilled", value: { data: newBook } };
  } catch (err: any) {
    return { status: "rejected", reason: err.message, work_olid: workId };
  }
}

export const deleteImportedVietnameseBooks = async (req: Request, res: Response) => {
  try {
    // Note: The original controller specifically targeted "Vietnamese".
    // We keep this behavior as requested by function name.
    const books = await prisma.book.findMany({
      where: { language: "Vietnamese" },
      select: { id: true },
    });
    const bookIds = books.map((b) => b.id);

    if (bookIds.length === 0) return sendResponse(res, 200, "success", { count: 0 });

    // Cleanup Relations
    const copies = await prisma.bookcopy.findMany({
      where: { bookId: { in: bookIds } },
      select: { id: true },
    });
    const copyIds = copies.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
        // External relations
        await tx.booksOnGenres.deleteMany({ where: { bookId: { in: bookIds } } });

        
        // Loans
        if (copyIds.length > 0) {
            await tx.loan.deleteMany({ where: { bookcopyId: { in: copyIds } } });
            await tx.bookcopy.deleteMany({ where: { bookId: { in: bookIds } } });
        }
        
        // Books
        await tx.book.deleteMany({ where: { id: { in: bookIds } } });
    });

    return sendResponse(res, 200, "success", { count: bookIds.length });
  } catch (err: any) {
    return sendResponse(res, 500, "error", err.message);
  }
};

export const importBooksByLanguage = async (req: Request, res: Response) => {
  try {
    clearCache();
    const language = req.body.language || "vie";
    const limit = Math.min(req.body.limit || 50, 1000);
    const MAX_CONCURRENCY = 10;

    console.log(`🔎 Searching for books in language: ${language} (Limit: ${limit})`);

    const validWorkIds: string[] = [];
    let page = 1;
    let totalScanned = 0;

    while (validWorkIds.length < limit) {
      const searchUrl = `https://openlibrary.org/search.json?q=language:${language}&page=${page}&limit=100&fields=key,title`;
      try {
          const data = await getJSON(searchUrl);
          const docs = data.docs || [];
          if (docs.length === 0) break;
          
          totalScanned += docs.length;
          for (const doc of docs) {
             if (validWorkIds.length >= limit) break;
             const workId = doc.key.split("/").pop();
             if (workId && !validWorkIds.includes(workId)) {
                 validWorkIds.push(workId);
             }
          }
          page++;
          if (page > 50) break; 
          await sleep(200);
      } catch (e) { break; }
    }

    if (validWorkIds.length === 0) {
      return sendResponse(res, 404, "error", "No books found.");
    }

    const results: any[] = [];
    for (let i = 0; i < validWorkIds.length; i += MAX_CONCURRENCY) {
      const chunk = validWorkIds.slice(i, i + MAX_CONCURRENCY);
      const chunkRes = await Promise.all(chunk.map((wid) => processWork(wid, language)));
      results.push(...chunkRes);
      await sleep(200);
    }

    const success = results.filter(r => r.status === "fulfilled");
    const failed = results.filter(r => r.status === "rejected");

    return sendResponse(res, 200, "success", {
      stats: {
        requested: limit,
        scanned: totalScanned,
        valid: validWorkIds.length,
        success: success.length,
        failed: failed.length,
      },
      data: success.map(r => r.value?.data),
      failed_data: failed.map(r => ({ work: r.work_olid, reason: r.reason }))
    });

  } catch (err: any) {
    return sendResponse(res, 500, "error", err.message);
  }
};
