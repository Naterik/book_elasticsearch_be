import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";

// ================= CONFIGURATION =================
const MAX_CONCURRENCY = 10;
const RETRIES = 3;
const RETRY_BASE_MS = 1000;
const PAGE_SIZE = 100;

// ================= HELPERS: FETCHING =================
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJSON<T = any>(url: string, attempt = 1): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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

// ================= VIETNAMESE VALIDATION =================

/**
 * CÃ¡c tá»• há»£p phá»¥ Ã¢m KHÃ”NG Há»¢P Lá»† trong tiáº¿ng Viá»‡t (lá»—i OCR)
 * Tiáº¿ng Viá»‡t chá»‰ cÃ³: tr, ch, gh, gi, kh, ng, ngh, nh, ph, qu, th
 */
const INVALID_CONSONANT_CLUSTERS = [
  // Lá»—i OCR phá»• biáº¿n
  /ck/i,
  /nz/i,
  /hs/i,
  /ls/i,
  /sr/i,
  /tl/i,
  /dl/i,
  /sy/i, // "syu" - lá»—i OCR tá»« "yÃªu"
  /Ä‘s/i, // "Ä‘sau" - lá»—i OCR tá»« "Ä‘áº§u"
  /mr/i, // "Mroi" - lá»—i OCR tá»« "MÆ°á»i"
  /iÃ©Ì‚/i, // dáº¥u káº¿t há»£p sai "biÃ©Ì‚c"
  /Ã¡Ì†/i, // dáº¥u káº¿t há»£p sai "MÃ¡Ì†t"

  // Tá»• há»£p khÃ´ng tá»“n táº¡i trong tiáº¿ng Viá»‡t
  /bn/i,
  /dn/i,
  /cn/i,
  /gn/i,
  /tn/i,
  /pn/i,
  /mn/i,
  /ln/i,
  /rn/i,
  /sn/i,
  /vn/i,
  /xn/i,
  /zn/i,
  /bk/i,
  /dk/i,
  /fk/i,
  /gk/i,
  /hk/i,
  /jk/i,
  /lk/i,
  /mk/i,
  /nk/i,
  /pk/i,
  /rk/i,
  /sk/i,
  /tk/i,
  /vk/i,
  /wk/i,
  /xk/i,
  /zk/i,
  /[bcdfghjklmnpqrstvwxz]{3,}/i, // 3+ phá»¥ Ã¢m liÃªn tiáº¿p
];

/**
 * CÃ¡c tá»«/pattern lá»—i OCR cá»¥ thá»ƒ cáº§n loáº¡i bá»
 */
const OCR_ERROR_WORDS = [
  /syu/i, // "TÃ¬nh syu" thay vÃ¬ "TÃ¬nh yÃªu"
  /ckua/i, // "ckua" thay vÃ¬ "cá»§a"
  /Ä‘sau/i, // "Ä‘sau" thay vÃ¬ "Ä‘áº§u"
  /mroi/i, // "Mroi" thay vÃ¬ "MÆ°á»i"
  /biÃ©Ì‚c/i, // lá»—i dáº¥u "biáº¿c"
  /mÃ¡Ì†t/i, // lá»—i dáº¥u "Máº¯t"
  /nhzung/i, // "nhzung" thay vÃ¬ "nhá»¯ng"
  /hson/i, // lá»—i OCR
  /lseu/i, // "lseu" thay vÃ¬ "lá»u"
  /titeu/i, // "titeu" thay vÃ¬ "tiá»ƒu"
  /thuyret/i, // "thuyret" thay vÃ¬ "thuyáº¿t"
];

/**
 * Kiá»ƒm tra kÃ½ tá»± Unicode bá»‹ há»ng (combining diacritical marks sai vá»‹ trÃ­)
 * VÃ­ dá»¥: "Ã¡Ì†" cÃ³ 2 dáº¥u káº¿t há»£p, "Ã©Ì‚" cÅ©ng váº­y
 */
const BROKEN_UNICODE_PATTERN = /[\u0300-\u036f]{2,}/; // 2+ combining marks liÃªn tiáº¿p

const FORBIDDEN_CHARS = /[=\+\*\#\@\$\%\^\&\{\}\[\]\\|<>~`]/;

const GARBAGE_PATTERNS = [
  /\(\s*\)/,
  /\[\s*\]/,
  /\s{3,}/,
  /^[^a-zA-Z\u00C0-\u1EF9]/,
  /[^a-zA-Z\u00C0-\u1EF90-9\s]$/,
  /:.*:/,
  /=.*:/,
];

const VIETNAMESE_VOWELS =
  /[aÃ Ã¡áº£Ã£áº¡Äƒáº±áº¯áº³áºµáº·Ã¢áº§áº¥áº©áº«áº­eÃ¨Ã©áº»áº½áº¹Ãªá»áº¿á»ƒá»…á»‡iÃ¬Ã­á»‰Ä©á»‹oÃ²Ã³á»Ãµá»Ã´á»“á»‘á»•á»—á»™Æ¡á»á»›á»Ÿá»¡á»£uÃ¹Ãºá»§Å©á»¥Æ°á»«á»©á»­á»¯á»±yá»³Ã½á»·á»¹á»µ]/i;
const VIETNAMESE_DIACRITICS =
  /[Ã Ã¡áº£Ã£áº¡Äƒáº±áº¯áº³áºµáº·Ã¢áº§áº¥áº©áº«áº­Ã¨Ã©áº»áº½áº¹Ãªá»áº¿á»ƒá»…á»‡Ã¬Ã­á»‰Ä©á»‹Ã²Ã³á»Ãµá»Ã´á»“á»‘á»•á»—á»™Æ¡á»á»›á»Ÿá»¡á»£Ã¹Ãºá»§Å©á»¥Æ°á»«á»©á»­á»¯á»±á»³Ã½á»·á»¹á»µÄ‘]/i;

function isValidVietnameseSyllable(word: string): boolean {
  if (!word || word.length === 0) return true;
  if (/^\d+$/.test(word) || word.length <= 2) return true;
  if (!VIETNAMESE_VOWELS.test(word)) return false;

  // Kiá»ƒm tra lá»—i OCR cá»¥ thá»ƒ trong tá»«
  for (const pattern of OCR_ERROR_WORDS) {
    if (pattern.test(word)) return false;
  }

  // Kiá»ƒm tra tá»• há»£p phá»¥ Ã¢m khÃ´ng há»£p lá»‡
  for (const pattern of INVALID_CONSONANT_CLUSTERS) {
    if (pattern.test(word)) return false;
  }
  return true;
}

function isValidVietnameseTitle(title: string): boolean {
  if (!title || title.trim().length < 2) return false;
  const cleanTitle = title.trim();

  // Kiá»ƒm tra Unicode bá»‹ há»ng (combining marks sai)
  if (BROKEN_UNICODE_PATTERN.test(cleanTitle)) return false;

  // Kiá»ƒm tra lá»—i OCR trong toÃ n bá»™ title
  for (const pattern of OCR_ERROR_WORDS) {
    if (pattern.test(cleanTitle)) return false;
  }

  if (FORBIDDEN_CHARS.test(cleanTitle)) return false;
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(cleanTitle)) return false;
  }

  const words = cleanTitle.split(/\s+/);
  let invalidWordCount = 0;
  let vietnameseWordCount = 0;

  for (const word of words) {
    const cleanWord = word.replace(
      /^[.,\-\?!'"\(\):]+|[.,\-\?!'"\(\):]+$/g,
      ""
    );
    if (cleanWord.length === 0) continue;

    if (!isValidVietnameseSyllable(cleanWord)) {
      invalidWordCount++;
      if (invalidWordCount >= 2) return false;
    }

    if (VIETNAMESE_DIACRITICS.test(cleanWord)) {
      vietnameseWordCount++;
    }
  }

  if (vietnameseWordCount === 0) return false;
  if (words.length > 0 && invalidWordCount / words.length > 0.2) return false;

  return true;
}

// ================= HELPERS: CACHING & DATABASE =================
const requestCache = {
  authors: new Map<string, number>(),
  publishers: new Map<string, number>(),
  genres: new Map<string, number>(),
};

function clearCache() {
  requestCache.authors.clear();
  requestCache.publishers.clear();
  requestCache.genres.clear();
}

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
  const cleanName = name ? name.trim() : "NhÃ  xuáº¥t báº£n khÃ´ng xÃ¡c Ä‘á»‹nh";
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

// ================= HELPERS =================
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
  let truncated = cleanText.slice(0, 252);
  const lastSpaceIndex = truncated.lastIndexOf(" ");
  if (lastSpaceIndex > 0) truncated = truncated.slice(0, lastSpaceIndex);
  return truncated + "...";
}

function getLanguageName(langKey: string | null | undefined): string {
  if (!langKey) return "Unknown";
  const langCode = langKey.split("/").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    vie: "Vietnamese",
    eng: "English",
    fre: "French",
    fra: "French",
    ger: "German",
    deu: "German",
    spa: "Spanish",
    chi: "Chinese",
    zho: "Chinese",
    jpn: "Japanese",
    kor: "Korean",
    rus: "Russian",
  };
  return languageMap[langCode || ""] || langCode || "Unknown";
}

// ================= INTERFACES =================
interface SearchDoc {
  key: string;
  title: string;
  language?: string[];
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

interface ProcessResult {
  status: "fulfilled" | "rejected";
  value?: any;
  reason?: string;
  work_olid?: string;
}

// ================= PROCESS SINGLE WORK =================
async function processVietnameseWork(workId: string): Promise<ProcessResult> {
  try {
    const workUrl = `https://openlibrary.org/works/${workId}.json`;
    const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=50`;

    const [workData, edsData] = await Promise.all([
      getJSON(workUrl),
      getJSON(edsUrl),
    ]);

    const entries = edsData.entries || [];
    if (entries.length === 0) throw new Error("No editions found");

    const langKey = "/languages/vie";

    // TÃ¬m edition tiáº¿ng Viá»‡t
    let edition = entries.find((e: any) => {
      if (!e.languages) return false;
      const hasVieLang = e.languages.some((l: any) => l.key === langKey);
      return hasVieLang && isValidVietnameseTitle(e.title);
    });

    if (!edition) {
      edition = entries.find((e: any) => {
        if (!e.languages) return false;
        return e.languages.some((l: any) => l.key === langKey);
      });
    }

    if (!edition) {
      edition = entries.find((e: any) => isValidVietnameseTitle(e.title));
    }

    if (!edition) throw new Error("No Vietnamese edition found");

    const title = edition.title || workData.title || "Untitled";
    if (!isValidVietnameseTitle(title)) {
      throw new Error(`Title not valid Vietnamese: ${title}`);
    }

    // Language tá»« API (khÃ´ng fix cá»©ng)
    let actualLanguage = "Unknown";
    if (edition.languages && edition.languages.length > 0) {
      actualLanguage = getLanguageName(edition.languages[0].key);
    }

    // Author
    let authorName = "TÃ¡c giáº£ khÃ´ng xÃ¡c Ä‘á»‹nh";
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
      } catch (e) {
        /* ignore */
      }
    }

    const isbn = (
      edition.isbn_13?.[0] ||
      edition.isbn_10?.[0] ||
      `OL-${workId}`
    ).trim();

    // Check existing
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
      "ChÆ°a cÃ³ mÃ´ táº£.";
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
          shortDesc: ensureShortDesc(descRaw),
          detailDesc: descRaw,
          price,
          quantity,
          publishDate: validDate,
          image,
          language: actualLanguage,
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

    return {
      status: "fulfilled",
      value: {
        data: newBook,
        source: { work_olid: workId, detected_language: actualLanguage },
      },
    };
  } catch (err: any) {
    return { status: "rejected", reason: err.message, work_olid: workId };
  }
}

// ================= MAIN API: Import sÃ¡ch tiáº¿ng Viá»‡t =================
/**
 * POST /api/v1/books/vietnamese
 *
 * Body:
 * - fromPage: trang báº¯t Ä‘áº§u (default: 1)
 * - toPage: trang káº¿t thÃºc (default: 10)
 *
 * VÃ­ dá»¥: { "fromPage": 1, "toPage": 5 } => Láº¥y tá»« trang 1 Ä‘áº¿n trang 5
 */
export const vietnameseBooksController = async (
  req: Request,
  res: Response
) => {
  try {
    clearCache();

    const fromPage = Math.max(1, req.body.fromPage || 1);
    const toPage = Math.min(100, req.body.toPage || 10);

    if (fromPage > toPage) {
      return sendResponse(res, 400, "error", "fromPage pháº£i nhá» hÆ¡n hoáº·c báº±ng toPage");
    }

    console.log(
      `ðŸ“š Import Vietnamese books - Tá»« trang ${fromPage} Ä‘áº¿n trang ${toPage}`
    );

    // 1. Thu tháº­p work IDs há»£p lá»‡ tá»« cÃ¡c trang
    const validWorkIds: string[] = [];
    let totalScanned = 0;

    for (let page = fromPage; page <= toPage; page++) {
      const searchUrl = `https://openlibrary.org/search.json?q=language:vie&page=${page}&limit=${PAGE_SIZE}&fields=key,title,language`;

      console.log(`  ðŸ“– Äang xá»­ lÃ½ trang ${page}/${toPage}...`);

      try {
        const searchResult = await getJSON(searchUrl);
        const docs: SearchDoc[] = searchResult.docs || [];

        if (docs.length === 0) {
          console.log(`  âš ï¸ Trang ${page} khÃ´ng cÃ³ dá»¯ liá»‡u`);
          continue;
        }

        totalScanned += docs.length;

        for (const doc of docs) {
          const workId = doc.key?.split("/").pop();
          if (!workId || validWorkIds.includes(workId)) continue;

          if (isValidVietnameseTitle(doc.title)) {
            validWorkIds.push(workId);
          }
        }

        await sleep(300); // Rate limiting
      } catch (err) {
        console.log(`  âŒ Lá»—i trang ${page}:`, err);
      }
    }

    console.log(
      `âœ… TÃ¬m tháº¥y ${validWorkIds.length} sÃ¡ch há»£p lá»‡ tá»« ${totalScanned} káº¿t quáº£`
    );

    if (validWorkIds.length === 0) {
      return sendResponse(res, 404, "error", {
        stats: {
          fromPage,
          toPage,
          totalScanned,
          validFound: 0,
        },
      });
    }

    // 2. Import vÃ o database
    const results: ProcessResult[] = [];

    for (let i = 0; i < validWorkIds.length; i += MAX_CONCURRENCY) {
      const chunk = validWorkIds.slice(i, i + MAX_CONCURRENCY);
      console.log(
        `  ðŸ”„ Batch ${Math.floor(i / MAX_CONCURRENCY) + 1}/${Math.ceil(
          validWorkIds.length / MAX_CONCURRENCY
        )}...`
      );

      const promises = chunk.map((wid) => processVietnameseWork(wid));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);

      await sleep(500);
    }

    // 3. Tá»•ng há»£p káº¿t quáº£
    const successResults = results.filter((r) => r.status === "fulfilled");
    const failedResults = results.filter((r) => r.status === "rejected");

    const importedBooks = successResults
      .map((r) => r.value?.data)
      .filter(Boolean);
    const failedBooks = failedResults.slice(0, 10).map((r) => ({
      work_id: r.work_olid,
      reason: r.reason,
    }));

    console.log(
      `\nðŸŽ‰ HoÃ n táº¥t: ${successResults.length} thÃ nh cÃ´ng, ${failedResults.length} tháº¥t báº¡i`
    );

    return sendResponse(res, 200, "success", {
      stats: {
        fromPage,
        toPage,
        pagesProcessed: toPage - fromPage + 1,
        totalScanned,
        validCandidates: validWorkIds.length,
        success: successResults.length,
        failed: failedResults.length,
      },
      data: importedBooks,
      failed: failedBooks,
    });
  } catch (err: any) {
    console.error("Import error:", err);
    return sendResponse(res, 500, "error", err.message);
  }
};

