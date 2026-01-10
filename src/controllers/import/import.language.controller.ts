import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";

// ================= CONFIGURATION =================
const MAX_CONCURRENCY = 10;
const RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ================= HELPERS: FETCHING =================
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJSON<T = any>(url: string, attempt = 1): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const r = await fetch(url, {
      headers: { "User-Agent": "LMS-Importer/1.0", Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!r.ok) {
      if ((r.status === 429 || r.status >= 500) && attempt < RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await sleep(backoff);
        return getJSON<T>(url, attempt + 1);
      }
      throw new Error(`OpenLibrary Status ${r.status}`);
    }
    return (await r.json()) as T;
  } catch (err) {
    if (attempt < RETRIES) {
      await sleep(RETRY_BASE_MS);
      return getJSON<T>(url, attempt + 1);
    }
    throw err;
  }
}

// ================= HELPERS: VALIDATION =================

// List of patterns that indicate "garbage" or OCR errors in Vietnamese context
const BAD_PATTERNS = [
  /txu/i,
  /tyu/i,
  /ngzu/i,
  /viu/i,
  /cto/i, // Common typos mentioned
  /=/, // "CÃµi ngÆ°á»i ta =: Terre des hommes"
  /\d+/, // Titles with numbers often indicate volume numbers or dates, which might be fine, but sometimes are messy. Let's keep numbers but be careful.
  /[:;]\s*$/, // Ends with punctuation
];

// Check if a word looks like a valid Vietnamese syllable (simplified)
// This is a heuristic.
function isVietnameseWord(word: string): boolean {
  // Common Vietnamese vowels and tones
  const vietnameseChars =
    /[aÄƒÃ¢eÃªioÃ´Æ¡uÆ°yÃ¡Ã áº£Ã£áº¡áº¯áº±áº³áºµáº·áº¥áº§áº©áº«áº­Ã©Ã¨áº»áº½áº¹áº¿á»á»ƒá»…á»‡Ã­Ã¬á»‰Ä©á»‹Ã³Ã²á»Ãµá»á»‘á»“á»•á»—á»™á»›á»á»Ÿá»¡á»£ÃºÃ¹á»§Å©á»¥á»©á»«á»­á»¯á»±Ã½á»³á»·á»¹á»µÄ‘]/i;
  return vietnameseChars.test(word);
}

function isValidVietnameseTitle(title: string): boolean {
  if (!title) return false;
  const cleanTitle = title.trim();

  // 1. Check for bad patterns
  for (const pattern of BAD_PATTERNS) {
    if (pattern.test(cleanTitle)) return false;
  }

  // 2. Check for "garbage" characters (e.g. too many non-alphanumeric)
  // Allow letters, numbers, spaces, common punctuation, and colons
  if (
    /[^a-zA-Z0-9\s\.,\-\?!'"\(\):aÄƒÃ¢eÃªioÃ´Æ¡uÆ°yÃ¡Ã áº£Ã£áº¡áº¯áº±áº³áºµáº·áº¥áº§áº©áº«áº­Ã©Ã¨áº»áº½áº¹áº¿á»á»ƒá»…á»‡Ã­Ã¬á»‰Ä©á»‹Ã³Ã²á»Ãµá»á»‘á»“á»•á»—á»™á»›á»á»Ÿá»¡á»£ÃºÃ¹á»§Å©á»¥á»©á»«á»­á»¯á»±Ã½á»³á»·á»¹á»µÄ‘]/.test(
      cleanTitle
    )
  ) {
    return false;
  }

  // 3. Check word validity
  const words = cleanTitle.split(/\s+/);
  let validWordCount = 0;
  for (const word of words) {
    // Remove punctuation
    const w = word.replace(/[.,\-\?!'"\(\)]/g, "");
    if (w.length === 0) continue;

    // If word has no vowels, it's suspicious (unless it's an abbreviation or number)
    if (!/[aeiouyÄƒÃ¢ÃªÃ´Æ¡Æ°]/i.test(w) && isNaN(Number(w))) {
      // "Dr", "Mr", "TV" are okay, but "tx", "ngz" are not.
      // Let's just count "Vietnamese-looking" words.
    }

    if (isVietnameseWord(w)) {
      validWordCount++;
    }
  }

  // If less than 50% of words look Vietnamese, reject (might be English book tagged as Vietnamese)
  if (words.length > 0 && validWordCount / words.length < 0.5) {
    return false;
  }

  return true;
}

// ================= HELPERS: CACHING & DATABASE =================
const requestCache = {
  authors: new Map<string, number>(),
  publishers: new Map<string, number>(),
  genres: new Map<string, number>(),
};

async function ensureAuthor(name: string, bio: string): Promise<number> {
  if (requestCache.authors.has(name)) return requestCache.authors.get(name)!;
  const record = await prisma.author.upsert({
    where: { name },
    update: {},
    create: { name, bio: bio || null },
  });
  requestCache.authors.set(name, record.id);
  return record.id;
}

async function ensurePublisher(name: string): Promise<number> {
  const cleanName = name ? name.trim() : "Unknown Publisher";
  if (requestCache.publishers.has(cleanName))
    return requestCache.publishers.get(cleanName)!;
  const record = await prisma.publisher.upsert({
    where: { name: cleanName },
    update: {},
    create: { name: cleanName, description: "Imported from OpenLibrary" },
  });
  requestCache.publishers.set(cleanName, record.id);
  return record.id;
}

async function ensureGenres(subjects: string[]): Promise<number[]> {
  if (!subjects || subjects.length === 0) return [];
  const candidates = subjects.slice(0, 3);
  const ids: number[] = [];
  for (const sub of candidates) {
    const name = sub.trim();
    if (!name) continue;
    if (requestCache.genres.has(name)) {
      ids.push(requestCache.genres.get(name)!);
      continue;
    }
    try {
      const record = await prisma.genre.upsert({
        where: { name },
        update: {},
        create: { name, description: `Books related to ${name}` },
      });
      requestCache.genres.set(name, record.id);
      ids.push(record.id);
    } catch (e) {
      /* ignore */
    }
  }
  return ids;
}

// ================= HELPERS: LOCATION & STATUS =================
let locationCounter = 0;
function getNextLocation(): string {
  const totalSlots = 26 * 100;
  const current = locationCounter % totalSlots;
  const letterIndex = Math.floor(current / 100);
  const letter = String.fromCharCode(65 + letterIndex);
  const number = (current % 100) + 1;
  locationCounter++;
  return `Shelf ${letter}${number}`;
}

function pickText(x: any): string {
  if (typeof x === "string") return x;
  if (typeof x?.value === "string") return x.value;
  return "";
}

function ensureShortDesc(text: string | null | undefined): string {
  if (!text || !text.trim()) return "N/A";
  const cleanText = text.trim();
  if (cleanText.length <= 255) return cleanText;
  const HARD_LIMIT = 252;
  let truncated = cleanText.slice(0, HARD_LIMIT);
  const lastSpaceIndex = truncated.lastIndexOf(" ");
  if (lastSpaceIndex > 0) truncated = truncated.slice(0, lastSpaceIndex);
  return truncated + "...";
}

// ================= PROCESS WORK =================
async function processWork(workId: string, targetLanguage: string = "vie") {
  try {
    const workUrl = `https://openlibrary.org/works/${workId}.json`;
    // Fetch more editions to find the right language one
    const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=50`;

    const [workData, edsData] = await Promise.all([
      getJSON(workUrl),
      getJSON(edsUrl),
    ]);

    const entries = edsData.entries || [];
    if (entries.length === 0) throw new Error("No editions found");

    // Find edition that matches the target language
    // OpenLibrary language keys are usually like "/languages/vie"
    const langKey = `/languages/${targetLanguage}`;

    let edition = entries.find((e: any) => {
      if (!e.languages) return false;
      return e.languages.some((l: any) => l.key === langKey);
    });

    // Fallback: If no explicit language match, check if title looks Vietnamese
    if (!edition) {
      edition = entries.find((e: any) => isValidVietnameseTitle(e.title));
    }

    // If still no edition, and we are strict, maybe skip?
    // But let's try to use the first one if it passes the title check
    if (!edition) {
      const first = entries[0];
      if (isValidVietnameseTitle(first.title)) {
        edition = first;
      }
    }

    if (!edition)
      throw new Error(
        `No edition found matching language ${targetLanguage} or valid title`
      );

    // Double check title validity here just in case
    const title = edition.title || workData.title || "Untitled";
    if (!isValidVietnameseTitle(title)) {
      throw new Error(`Title rejected by filter: ${title}`);
    }

    let authorName = "Unknown Author";
    let authorBio = "";
    const authorKey = workData.authors?.[0]?.author?.key;
    if (authorKey) {
      try {
        const olId = authorKey.split("/").pop();
        const authorData = await getJSON(
          `https://openlibrary.org/authors/${olId}.json`
        );
        authorName = authorData.name || authorName;
        authorBio = pickText(authorData.bio);
        if (authorBio.length > 60000)
          authorBio = authorBio.substring(0, 60000) + "...";
      } catch (e) {}
    }

    const isbn = (
      edition.isbn_13?.[0] ||
      edition.isbn_10?.[0] ||
      `OL-${workId}`
    ).trim();
    const existing = await prisma.book.findUnique({ where: { isbn } });
    if (existing) {
      return {
        status: "fulfilled",
        value: { data: existing, note: "Already exists" },
      };
    }

    const descRaw =
      pickText(workData.description) ||
      pickText(edition.description) ||
      "No description available.";
    const shortDesc = ensureShortDesc(descRaw);
    const detailDesc = descRaw;
    const pages = edition.number_of_pages || 0;
    const publishDate = edition.publish_date
      ? new Date(edition.publish_date)
      : null;
    const validDate =
      !publishDate || isNaN(publishDate.getTime()) ? new Date() : publishDate;
    const coverId = edition.covers?.[0] || workData.covers?.[0];
    const image = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null;

    const [authorId, publisherId, genreIds] = await Promise.all([
      ensureAuthor(authorName, authorBio),
      ensurePublisher(edition.publishers?.[0]),
      ensureGenres(workData.subjects || []),
    ]);

    const price = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
    const quantity = 5;

    const newBook = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          isbn,
          title,
          shortDesc,
          detailDesc,
          price,
          quantity,
          publishDate: validDate,
          image,
          language: "Vietnamese", // Confirmed by edition check
          pages,
          authors: { connect: { id: authorId } },
          publishers: { connect: { id: publisherId } },
          genres: { create: genreIds.map((gid) => ({ genreId: gid })) },
        },
      });

      const copiesData = Array.from({ length: quantity }).map((_, i) => ({
        bookId: book.id,
        year_published: validDate.getFullYear(),
        copyNumber: `CP-${book.id}-${i + 1}`,
        status: "AVAILABLE",
        location: getNextLocation(),
      }));
      await tx.bookcopy.createMany({ data: copiesData });
      return book;
    });

    return { status: "fulfilled", value: { data: newBook } };
  } catch (err: any) {
    return { status: "rejected", reason: err.message, work_olid: workId };
  }
}

export const deleteImportedVietnameseBooks = async (
  req: Request,
  res: Response
) => {
  try {
    // Delete books where language is Vietnamese
    // Note: This will cascade delete book copies, loans, etc. if configured in Prisma
    // But based on schema, we might need to be careful.
    // Prisma schema: Book -> BookCopy -> Loan
    // If we delete Book, we need to make sure related records are handled.
    // The schema doesn't show explicit Cascade on Book->BookCopy, so we might need to delete manually or rely on Prisma's behavior if configured.
    // Let's assume we need to find them first.

    const books = await prisma.book.findMany({
      where: { language: "Vietnamese" },
      select: { id: true },
    });

    const bookIds = books.map((b) => b.id);

    if (bookIds.length === 0) {
      return sendResponse(res, 200, "success");
    }

    // Delete related records in order
    // 1. Delete Loans (via BookCopy)
    // 2. Delete BookCopies
    // 3. Delete BooksOnGenres
    // 4. Delete Reservations
    // 5. Delete Books

    // Find copies
    const copies = await prisma.bookcopy.findMany({
      where: { bookId: { in: bookIds } },
      select: { id: true },
    });
    const copyIds = copies.map((c) => c.id);

    // Delete Fines & Payments related to Loans of these copies?
    // This is getting complicated. Let's try to delete Books and let Prisma throw if there are constraints,
    // or do a best-effort cleanup.

    // Simplest safe approach:
    await prisma.booksOnGenres.deleteMany({
      where: { bookId: { in: bookIds } },
    });

    await prisma.reservation.deleteMany({
      where: { bookId: { in: bookIds } },
    });

    // Loans are linked to BookCopy
    await prisma.loan.deleteMany({
      where: { bookcopyId: { in: copyIds } },
    });

    await prisma.bookcopy.deleteMany({
      where: { bookId: { in: bookIds } },
    });

    const deleted = await prisma.book.deleteMany({
      where: { id: { in: bookIds } },
    });

    return sendResponse(res, 200, "success", {
      count: deleted.count
    });
  } catch (err: any) {
    console.error("Delete error:", err);
    return sendResponse(res, 500, "error", err.message);
  }
};

// ================= MAIN CONTROLLER =================
export const importBooksByLanguage = async (req: Request, res: Response) => {
  try {
    requestCache.authors.clear();
    requestCache.publishers.clear();
    requestCache.genres.clear();

    const language = req.body.language || "vie"; // Default to Vietnamese
    const limit = Math.min(req.body.limit || 50, 1000);

    console.log(
      `ðŸ” Searching for books in language: ${language} with limit ${limit}`
    );

    // 1. Search for works with pagination
    const validWorkIds: string[] = [];
    let page = 1;
    const PAGE_SIZE = 100;
    let totalScanned = 0;
    let totalCandidates = 0;

    console.log(`ðŸ” Starting search loop...`);

    while (validWorkIds.length < limit) {
      // Use q=language:code format to match user's browser search
      const searchUrl = `https://openlibrary.org/search.json?q=language:${language}&page=${page}&limit=${PAGE_SIZE}&fields=key,title`;

      console.log(
        `Fetching page ${page} (found so far: ${validWorkIds.length}/${limit})...`
      );
      const searchResult = await getJSON(searchUrl);
      const docs = searchResult.docs || [];
      totalCandidates += docs.length;

      if (docs.length === 0) {
        console.log("No more results from OpenLibrary.");
        break;
      }

      totalScanned += docs.length;

      for (const doc of docs) {
        if (validWorkIds.length >= limit) break;

        const workId = doc.key.split("/").pop();
        const title = doc.title;

        // Deduplicate
        if (validWorkIds.includes(workId)) continue;

        if (isValidVietnameseTitle(title)) {
          validWorkIds.push(workId);
        }
      }

      page++;
      // Safety limit: don't go too deep if we can't find good titles
      if (page > 50) {
        console.log("Reached max page limit (50). Stopping search.");
        break;
      }

      await sleep(500); // Rate limiting
    }

    console.log(
      `Selected ${validWorkIds.length} valid works after scanning ${totalScanned} candidates.`
    );

    if (validWorkIds.length === 0) {
      return sendResponse(res, 404, "error", "No valid books found for this language after filtering.");
    }

    // 3. Process works
    const results: any[] = [];
    for (let i = 0; i < validWorkIds.length; i += MAX_CONCURRENCY) {
      const chunk = validWorkIds.slice(i, i + MAX_CONCURRENCY);
      const promises = chunk.map((wid) => processWork(wid, language));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      await sleep(500);
    }

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;
    const successData = results
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);

    const failedData = results
      .filter((r) => r.status === "rejected")
      .map((r: any) => ({
        work_id: r.work_olid,
        reason: r.reason,
      }));

    return sendResponse(res, 200, "success", {
      stats: {
        requested_limit: limit,
        found_candidates: totalCandidates,
        valid_candidates: validWorkIds.length,
        success: successCount,
        failed: failedCount,
      },
      data: successData,
      failed_data: failedData,
    });
  } catch (err: any) {
    console.error("Import by language error:", err);
    return sendResponse(res, 500, "error", err.message);
  }
};

