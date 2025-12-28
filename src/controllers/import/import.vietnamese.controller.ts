import { Request, Response } from "express";
import { prisma } from "configs/client";

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
 * Các tổ hợp phụ âm KHÔNG HỢP LỆ trong tiếng Việt (lỗi OCR)
 * Tiếng Việt chỉ có: tr, ch, gh, gi, kh, ng, ngh, nh, ph, qu, th
 */
const INVALID_CONSONANT_CLUSTERS = [
  // Lỗi OCR phổ biến
  /ck/i,
  /nz/i,
  /hs/i,
  /ls/i,
  /sr/i,
  /tl/i,
  /dl/i,
  /sy/i, // "syu" - lỗi OCR từ "yêu"
  /đs/i, // "đsau" - lỗi OCR từ "đầu"
  /mr/i, // "Mroi" - lỗi OCR từ "Mười"
  /ié̂/i, // dấu kết hợp sai "bié̂c"
  /á̆/i, // dấu kết hợp sai "Má̆t"

  // Tổ hợp không tồn tại trong tiếng Việt
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
  /[bcdfghjklmnpqrstvwxz]{3,}/i, // 3+ phụ âm liên tiếp
];

/**
 * Các từ/pattern lỗi OCR cụ thể cần loại bỏ
 */
const OCR_ERROR_WORDS = [
  /syu/i, // "Tình syu" thay vì "Tình yêu"
  /ckua/i, // "ckua" thay vì "của"
  /đsau/i, // "đsau" thay vì "đầu"
  /mroi/i, // "Mroi" thay vì "Mười"
  /bié̂c/i, // lỗi dấu "biếc"
  /má̆t/i, // lỗi dấu "Mắt"
  /nhzung/i, // "nhzung" thay vì "những"
  /hson/i, // lỗi OCR
  /lseu/i, // "lseu" thay vì "lều"
  /titeu/i, // "titeu" thay vì "tiểu"
  /thuyret/i, // "thuyret" thay vì "thuyết"
];

/**
 * Kiểm tra ký tự Unicode bị hỏng (combining diacritical marks sai vị trí)
 * Ví dụ: "á̆" có 2 dấu kết hợp, "é̂" cũng vậy
 */
const BROKEN_UNICODE_PATTERN = /[\u0300-\u036f]{2,}/; // 2+ combining marks liên tiếp

const FORBIDDEN_CHARS = /[=\+\*\#\@\$\%\^\&\{\}\[\]\\|<>~`]/;

const GARBAGE_PATTERNS = [
  /\(\s*\)/,
  /\[\s*\]/,
  /\s{3,}/,
  /^[^a-zA-ZÀ-ỹ]/,
  /[^a-zA-ZÀ-ỹ0-9\s]$/,
  /:.*:/,
  /=.*:/,
];

const VIETNAMESE_VOWELS =
  /[aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵ]/i;
const VIETNAMESE_DIACRITICS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function isValidVietnameseSyllable(word: string): boolean {
  if (!word || word.length === 0) return true;
  if (/^\d+$/.test(word) || word.length <= 2) return true;
  if (!VIETNAMESE_VOWELS.test(word)) return false;

  // Kiểm tra lỗi OCR cụ thể trong từ
  for (const pattern of OCR_ERROR_WORDS) {
    if (pattern.test(word)) return false;
  }

  // Kiểm tra tổ hợp phụ âm không hợp lệ
  for (const pattern of INVALID_CONSONANT_CLUSTERS) {
    if (pattern.test(word)) return false;
  }
  return true;
}

function isValidVietnameseTitle(title: string): boolean {
  if (!title || title.trim().length < 2) return false;
  const cleanTitle = title.trim();

  // Kiểm tra Unicode bị hỏng (combining marks sai)
  if (BROKEN_UNICODE_PATTERN.test(cleanTitle)) return false;

  // Kiểm tra lỗi OCR trong toàn bộ title
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
  const cleanName = name ? name.trim() : "Nhà xuất bản không xác định";
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

    // Tìm edition tiếng Việt
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

    // Language từ API (không fix cứng)
    let actualLanguage = "Unknown";
    if (edition.languages && edition.languages.length > 0) {
      actualLanguage = getLanguageName(edition.languages[0].key);
    }

    // Author
    let authorName = "Tác giả không xác định";
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
      "Chưa có mô tả.";
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

// ================= MAIN API: Import sách tiếng Việt =================
/**
 * POST /api/v1/books/vietnamese
 *
 * Body:
 * - fromPage: trang bắt đầu (default: 1)
 * - toPage: trang kết thúc (default: 10)
 *
 * Ví dụ: { "fromPage": 1, "toPage": 5 } => Lấy từ trang 1 đến trang 5
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
      return res.status(400).json({
        error: "fromPage phải nhỏ hơn hoặc bằng toPage",
      });
    }

    console.log(
      `📚 Import Vietnamese books - Từ trang ${fromPage} đến trang ${toPage}`
    );

    // 1. Thu thập work IDs hợp lệ từ các trang
    const validWorkIds: string[] = [];
    let totalScanned = 0;

    for (let page = fromPage; page <= toPage; page++) {
      const searchUrl = `https://openlibrary.org/search.json?q=language:vie&page=${page}&limit=${PAGE_SIZE}&fields=key,title,language`;

      console.log(`  📖 Đang xử lý trang ${page}/${toPage}...`);

      try {
        const searchResult = await getJSON(searchUrl);
        const docs: SearchDoc[] = searchResult.docs || [];

        if (docs.length === 0) {
          console.log(`  ⚠️ Trang ${page} không có dữ liệu`);
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
        console.log(`  ❌ Lỗi trang ${page}:`, err);
      }
    }

    console.log(
      `✅ Tìm thấy ${validWorkIds.length} sách hợp lệ từ ${totalScanned} kết quả`
    );

    if (validWorkIds.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy sách tiếng Việt hợp lệ",
        stats: {
          fromPage,
          toPage,
          totalScanned,
          validFound: 0,
        },
      });
    }

    // 2. Import vào database
    const results: ProcessResult[] = [];

    for (let i = 0; i < validWorkIds.length; i += MAX_CONCURRENCY) {
      const chunk = validWorkIds.slice(i, i + MAX_CONCURRENCY);
      console.log(
        `  🔄 Batch ${Math.floor(i / MAX_CONCURRENCY) + 1}/${Math.ceil(
          validWorkIds.length / MAX_CONCURRENCY
        )}...`
      );

      const promises = chunk.map((wid) => processVietnameseWork(wid));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);

      await sleep(500);
    }

    // 3. Tổng hợp kết quả
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
      `\n🎉 Hoàn tất: ${successResults.length} thành công, ${failedResults.length} thất bại`
    );

    return res.status(200).json({
      message: `Import hoàn tất: ${successResults.length} sách đã thêm vào database`,
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
    return res.status(500).json({ error: err.message });
  }
};
