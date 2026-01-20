import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";
import {
  ALLOWED_GENERAL_GENRES,
  getJSON,
  ensureAuthor,
  ensurePublisher,
  ensureGenres,
  isValidTitle,
  isValidIsbn,
  pickText,
  ensureShortDesc,
  sleep,
  clearRequestCache,
  cleanBookTitle
} from "./import.helpers";

// ================= CONFIGURATION =================
const MAX_CONCURRENCY = 50; // Increased from 20 for speed
const EDITION_CHECK_CONCURRENCY = 20; // Increased from 10
const SUBJECT_API_PAGE_LIMIT = 2000;

// ================= HELPERS: FETCHING =================

/**
 * Fetches works from a subject and returns only work IDs that have at least one valid edition.
 * Ensures we don't waste time on empty works.
 * Supports Offset for deep pagination.
 */
async function getValidWorkIdsFromSubject(
  subject: string,
  desiredLimit = 500,
  offset = 0
): Promise<string[]> {
  if (!subject) return [];
  
  // Request a bit more than desired to account for filtering
  const fetchLimit = Math.min(Math.max(desiredLimit * 2, 100), SUBJECT_API_PAGE_LIMIT);
  const subjectUrl = `https://openlibrary.org/subjects/${encodeURIComponent(
    subject.toLowerCase()
  )}.json?limit=${fetchLimit}&offset=${offset}`;

  try {
    const data: any = await getJSON(subjectUrl);
    if (!data?.works || !Array.isArray(data.works)) return [];

    const workIds = data.works
      .map((w: any) =>
        typeof w.key === "string" ? w.key.split("/").pop() : null
      )
      .filter(Boolean) as string[];

    const uniqueIds = Array.from(new Set(workIds));
    const validIds: string[] = [];

    // Check for editions in parallel chunks
    for (let i = 0; i < uniqueIds.length; i += EDITION_CHECK_CONCURRENCY) {
      if (validIds.length >= desiredLimit) break;

      const chunk = uniqueIds.slice(i, i + EDITION_CHECK_CONCURRENCY);
      const checks = await Promise.all(
        chunk.map(async (wid) => {
          try {
            const edsUrl = `https://openlibrary.org/works/${wid}/editions.json?limit=1`;
            const edsData: any = await getJSON(edsUrl);
            if (edsData?.entries && edsData.entries.length > 0) return wid;
          } catch (e) {
            // Ignore errors
          }
          return null;
        })
      );

      checks.forEach((x) => {
        if (x) validIds.push(x);
      });

      await sleep(50); // Reduced delay for speed
    }

    return validIds.slice(0, desiredLimit);
  } catch (e) {
    console.error(`Error fetching subject ${subject} (offset ${offset}):`, e);
    return [];
  }
}

// ================= PROCESS WORK =================

async function processWork(workId: string) {
  try {
    const workUrl = `https://openlibrary.org/works/${workId}.json`;
    const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=1`;

    const [workData, edsData] = await Promise.all([
      getJSON(workUrl),
      getJSON(edsUrl),
    ]);

    const edition = edsData.entries?.[0];
    if (!edition) throw new Error("No edition found");

    // 1. Validate Title
    const rawTitle = edition.title || workData.title || "";
    // Clean Title First!
    const title = cleanBookTitle(rawTitle);
    
    if (!isValidTitle(title)) {
      throw new Error(`Invalid title (filtered): ${title}`);
    }

    // 2. Validate ISBN (Strict)
    const candidates = [
        ...(edition.isbn_13 || []),
    ];
    
    // Find the first VALID ISBN
    const validIsbn = candidates.find((isbn: string) => isValidIsbn(isbn));

    if (!validIsbn) {
      throw new Error("No valid ISBN-13 found");
    }
    const isbn = validIsbn;

    // 3. Check for Duplicates in DB
    const existing = await prisma.book.findUnique({ where: { isbn } });
    if (existing) {
      return { status: "fulfilled" as const, value: { skipped: true, isbn } };
    }

    // 4. Fetch Author Metadata
    let authorName = "Unknown Author";
    let authorBio = "";
    const authorKey = workData.authors?.[0]?.author?.key;

    if (authorKey) {
      try {
        const olId = authorKey.split("/").pop();
        const authorData = await getJSON(`https://openlibrary.org/authors/${olId}.json`);
        authorName = authorData.name || authorName;
        authorBio = pickText(authorData.bio);
        if (authorBio.length > 2000) authorBio = authorBio.substring(0, 2000) + "...";
      } catch (e) { /* ignore */ }
    }

    // 5. Prepare Book Data
    const descRaw = pickText(workData.description) || pickText(edition.description) || "No description available.";
    const shortDesc = ensureShortDesc(descRaw);
    
    const pages = edition.number_of_pages || 0;
    const publishDate = edition.publish_date ? new Date(edition.publish_date) : new Date();
    const validDate = isNaN(publishDate.getTime()) ? new Date() : publishDate;
    
    const coverId = edition.covers?.[0] || workData.covers?.[0];
    const image = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;

    // --- NEW: Digital Status Check ---
    // OpenLibrary keys: ia (Internet Archive ID), ebook_access
    // edition.ia, edition.ebook_access
    const iaId = edition.ia || workData.ia;
    const ebookAccess = edition.ebook_access || workData.ebook_access || "no_ebook";
    
    let previewStatus: "NO_VIEW" | "FULL" | "RESTRICTED" = "NO_VIEW";
    let previewUrl = null;

    if (ebookAccess === "public") {
        previewStatus = "FULL";
    } else if (ebookAccess === "borrowable" || ebookAccess === "printdisabled") {
        previewStatus = "RESTRICTED";
    }

    if (iaId && previewStatus !== "NO_VIEW") {
        previewUrl = `https://archive.org/details/${iaId}`;
    }
    // --------------------------------

    // 6. DB Upserts
    const [authorId, publisherId, genreIds] = await Promise.all([
      ensureAuthor(authorName, authorBio),
      ensurePublisher(edition.publishers?.[0]),
      ensureGenres(workData.subjects || []) 
    ]);

    if (genreIds.length === 0) {
        throw new Error("No valid genres found for this book in Allowed list.");
    }

    // 7. Create Book, Copies, and DigitalBook
    const price = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
    const quantity = 5; 

    const newBook = await prisma.$transaction(async (tx) => {
      // Create Book
      const book = await tx.book.create({
        data: {
          isbn,
          title,
          shortDesc,
          detailDesc: descRaw,
          price,
          quantity,
          publishDate: validDate,
          image,
          language: "eng",
          pages,
          authors: { connect: { id: authorId } },
          publishers: { connect: { id: publisherId } },
          genres: {
            create: genreIds.map((gid) => ({ genreId: gid })),
          },
          // Create DigitalBook relation if status is not NO_VIEW
          digitalBook: previewStatus !== "NO_VIEW" ? {
            create: {
                status: previewStatus,
                previewUrl: previewUrl
            }
          } : undefined
        },
      });

      // Create Copies
      const copiesData = Array.from({ length: quantity }).map((_, i) => ({
        bookId: book.id,
        year_published: validDate.getFullYear(),
        copyNumber: `CP-${book.id}-${i + 1}`,
        status: "AVAILABLE",
      }));
      await tx.bookcopy.createMany({ data: copiesData });
      
      return book;
    });

    return { status: "fulfilled" as const, value: { success: true, id: newBook.id, title: newBook.title, digital: previewStatus } };

  } catch (err: any) {
    return { status: "rejected" as const, reason: err.message || "Unknown error" };
  }
}

// ================= CONTROLLER: IMPORT 10K =================

/**
 * Controller to populate database up to 10,000 books using standard, popular genres.
 * Validates strictly for Title and Genre quality.
 * Loops UNTIL target is met.
 */
export const importBooksToReachTarget = async (req: Request, res: Response) => {
  try {
    clearRequestCache();
    
    // 1. Check current status
    let currentCount = await prisma.book.count();
    const TARGET = 10000;
    
    if (currentCount >= TARGET) {
      return sendResponse(res, 200, "success", {
        message: "Database already has enough books.",
        currentCount,
        target: TARGET
      });
    }

    console.log(`🎯 STARTING MASS IMPORT. Target: ${TARGET}. Current: ${currentCount}. Needed: ${TARGET - currentCount}`);

    const stats = {
      added: 0,
      errors: 0,
      genresProcessed: 0
    };

    // Initialize offsets for all genres
    const genreOffsets = new Map<string, number>();
    ALLOWED_GENERAL_GENRES.forEach(g => genreOffsets.set(g, 0));

    // --- MAIN LOOP ---
    // Start looping through genres to find books
    // We shuffle genres to vary the content
    const genres = [...ALLOWED_GENERAL_GENRES].sort(() => 0.5 - Math.random());
    const CONCURRENCY = 8; // Safer concurrency
    
    let genreIndex = 0;
    while (currentCount < TARGET) {
        if (genreIndex >= genres.length) {
            genreIndex = 0; // Loop back
            await sleep(2000);
        }

        const genre = genres[genreIndex];
        const currentOffset = genreOffsets.get(genre) || 0;
        
        console.log(`\n� Processing Genre: ${genre} (Offset: ${currentOffset})`);

        // 1. Fetch Candidates (No sort=edition_count to avoid 500)
        // We use Search API for better stability if Subject fails, but let's stick to Subject without sort first.
        let workIds: string[] = [];
        try {
            workIds = await getValidWorkIdsFromSubject(genre, 50, currentOffset);
        } catch (e) {
            console.error(`  ❌ Error fetching subject ${genre}:`, e);
            genreIndex++;
            continue;
        }

        if (workIds.length === 0) {
            console.log(`  ⚠ No more works for ${genre}. Skipping.`);
            genreIndex++;
            continue;
        }

        // 2. Process Batch
        const promises = workIds.map(wid => processWork(wid));
        const results = await Promise.allSettled(promises);

        let batchSuccess = 0;
        for (const res of results) {
            if (res.status === "fulfilled") {
                batchSuccess++;
                stats.added++;
            } else {
                stats.errors++;
                // console.error("Import error:", res.reason); // Optional: verbose log
            }
        }
        
        // 3. Update Progress
        currentCount = await prisma.book.count();
        console.log(`  ✨ Batch finished. Added: ${batchSuccess}. Total DB: ${currentCount}/${TARGET}`);

        // Update offset for next time
        genreOffsets.set(genre, currentOffset + workIds.length);
        
        // Move to next genre if this batch was small (running out of popular books in this genre)
        if (batchSuccess < 5) {
             genreIndex++;
        }
        
        // Safety break
        if (stats.errors > 2000 && stats.added === 0) {
             console.error("🚨 Too many consecutive errors. Aborting.");
             break;
        }
        
        await sleep(1000); // Be nice to OpenLibrary
    }

    const finalCount = await prisma.book.count();

    return sendResponse(res, 200, "success", {
        message: "Import batch processed",
        initialCount: finalCount - stats.added,
        finalCount: finalCount,
        addedInThisSession: stats.added,
        errors: stats.errors,
        targetReached: finalCount >= TARGET
    });

  } catch (error: any) {
    console.error("Import 10k Error:", error);
    // Even if error, return partial success if we added stuff
    return sendResponse(res, 500, "error", error.message);
  }
};
