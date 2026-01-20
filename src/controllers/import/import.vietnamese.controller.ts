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
  requestCache,
  cleanBookTitle
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

// ================= VIETNAMESE VALIDATION =================
/**
 * Vietnamese validation logic (OCR errors, syllables, etc.)
 */
const INVALID_CONSONANT_CLUSTERS = [
  /ck/i, /nz/i, /hs/i, /ls/i, /sr/i, /tl/i, /dl/i, /sy/i, /đs/i, /mr/i, /ié̂/i, /á̆/i,
  /bn/i, /dn/i, /cn/i, /gn/i, /tn/i, /pn/i, /mn/i, /ln/i, /rn/i, /sn/i, /vn/i, /xn/i, /zn/i,
  /bk/i, /dk/i, /fk/i, /gk/i, /hk/i, /jk/i, /lk/i, /mk/i, /nk/i, /pk/i, /rk/i, /sk/i, /tk/i,
  /vk/i, /wk/i, /xk/i, /zk/i, /[bcdfghjklmnpqrstvwxz]{3,}/i,
];

const OCR_ERROR_WORDS = [
  /syu/i, /ckua/i, /đsau/i, /mroi/i, /bié̂c/i, /má̆t/i, /nhzung/i, /hson/i, /lseu/i, /titeu/i, /thuyret/i,
];

const BROKEN_UNICODE_PATTERN = /[\u0300-\u036f]{2,}/;
const FORBIDDEN_CHARS = /[=\+\*\#\@\$\%\^\&\{\}\[\]\\|<>~`]/;
const GARBAGE_PATTERNS = [
  /\(\s*\)/, /\[\s*\]/, /\s{3,}/, /^[^a-zA-Z\u00C0-\u1EF9]/, /[^a-zA-Z\u00C0-\u1EF90-9\s]$/, /:.*:/, /=.*:/,
];

const VIETNAMESE_VOWELS = /[aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵ]/i;
const VIETNAMESE_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function isValidVietnameseSyllable(word: string): boolean {
  if (!word || word.length === 0) return true;
  if (/^\d+$/.test(word) || word.length <= 2) return true;
  if (!VIETNAMESE_VOWELS.test(word)) return false;
  for (const pattern of OCR_ERROR_WORDS) {
    if (pattern.test(word)) return false;
  }
  for (const pattern of INVALID_CONSONANT_CLUSTERS) {
    if (pattern.test(word)) return false;
  }
  return true;
}

function isValidVietnameseTitle(title: string): boolean {
  if (!title || title.trim().length < 2) return false;
  // Clean first!
  const cleanTitle = cleanBookTitle(title);

  if (BROKEN_UNICODE_PATTERN.test(cleanTitle)) return false;
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
    const cleanWord = word.replace(/^[.,\-\?!'"\(\):]+|[.,\-\?!'"\(\):]+$/g, "");
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

function getLanguageName(langKey: string | null | undefined): string {
  if (!langKey) return "Unknown";
  const langCode = langKey.split("/").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    vie: "Vietnamese", eng: "English", fre: "French", fra: "French", ger: "German", deu: "German",
    spa: "Spanish", chi: "Chinese", zho: "Chinese", jpn: "Japanese", kor: "Korean", rus: "Russian",
  };
  return languageMap[langCode || ""] || langCode || "Unknown";
}

// ================= PROCESS =================
interface ProcessResult {
  status: "fulfilled" | "rejected";
  value?: any;
  reason?: string;
  work_olid?: string;
}

async function processVietnameseWork(workId: string): Promise<ProcessResult> {
  try {
    const workUrl = `https://openlibrary.org/works/${workId}.json`;
    const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=50`;

    const [workData, edsData] = await Promise.all([getJSON(workUrl), getJSON(edsUrl)]);
    const entries = edsData.entries || [];
    if (entries.length === 0) throw new Error("No editions found");

    const langKey = "/languages/vie";
    let edition = entries.find((e: any) => e.languages?.some((l: any) => l.key === langKey) && isValidVietnameseTitle(e.title));
    if (!edition) edition = entries.find((e: any) => e.languages?.some((l: any) => l.key === langKey));
    if (!edition) edition = entries.find((e: any) => isValidVietnameseTitle(e.title));
    if (!edition) throw new Error("No Vietnamese edition found");

    const title = edition.title || workData.title || "Untitled";
    if (!isValidVietnameseTitle(title)) throw new Error(`Title not valid Vietnamese: ${title}`);

    let actualLanguage = "Unknown";
    if (edition.languages?.length > 0) actualLanguage = getLanguageName(edition.languages[0].key);

    // Author
    let authorName = "Tác giả không xác định";
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
    const existing = await prisma.book.findUnique({ where: { isbn } });
    if (existing) {
        return { status: "fulfilled", value: { data: existing, note: "Already exists" } };
    }

    const descRaw = pickText(workData.description) || pickText(edition.description) || "Chưa có mô tả.";
    const [authorId, publisherId, genreIds] = await Promise.all([
      ensureAuthor(authorName, authorBio),
      ensurePublisher(edition.publishers?.[0]),
      ensureGenres(workData.subjects || []),
    ]);

    const price = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
    const quantity = 5;
    const publishDate = edition.publish_date ? new Date(edition.publish_date) : null;
    const validDate = !publishDate || isNaN(publishDate.getTime()) ? new Date() : publishDate;

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
          language: actualLanguage,
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

    return { status: "fulfilled", value: { data: newBook, source: { work_olid: workId } } };
  } catch (err: any) {
    return { status: "rejected", reason: err.message, work_olid: workId };
  }
}

export const vietnameseBooksController = async (req: Request, res: Response) => {
  try {
    clearCache();
    const fromPage = Math.max(1, req.body.fromPage || 1);
    const toPage = Math.min(100, req.body.toPage || 10);
    const MAX_CONCURRENCY = 10;
    
    console.log(`📚 Import Vietnamese books - Pages ${fromPage} to ${toPage}`);

    // Scan loop
    const validWorkIds: string[] = [];
    let totalScanned = 0;

    // List of queries to maximize reach
    const QUERIES = [
        "language:vie",
        "publisher:\"Nha Xuat Ban Tre\"",
        "publisher:\"Nha Xuat Ban Kim Dong\"",
        "publisher:\"Nha Xuat Ban Van Hoc\"",
        "publisher:\"Nha Xuat Ban Hoi Nha Van\"",
        "place:Vietnam",
        "subject:Vietnam",
        "subject:Vietnamese"
    ];

    for (const query of QUERIES) {
        console.log(`🔍 Scanning Query: ${query}`);
        
        for (let page = fromPage; page <= toPage; page++) {
            try {
                // Encode query ensuring quotes are kept for search syntax
                const q = encodeURIComponent(query);
                const searchUrl = `https://openlibrary.org/search.json?q=${q}&page=${page}&limit=100&fields=key,title,language,author_name,cover_i`;
                
                console.log(`  📖 Scanning page ${page}...`);
                const data = await getJSON(searchUrl);
                const docs = data.docs || [];
                
                if (docs.length === 0) break; // Next query

                totalScanned += docs.length;
                
                for (const doc of docs) {
                    const workId = doc.key?.split("/").pop();
                    
                    // Double check Language if not searching by language explicit
                    // Note: OpenLibrary search is fuzzy. We must be strict on import.
                    
                    // Add if not seen
                    if (workId && !validWorkIds.includes(workId)) {
                        // Optimistic check: title looks Vietnamese?
                        if (isValidVietnameseTitle(doc.title)) {
                             validWorkIds.push(workId);
                        }
                    }
                }
                await sleep(500); // Be nice to API
            } catch (e) {
                 console.error(`Error scanning ${query} page ${page}:`, e);
            }
        }
    }

    if (validWorkIds.length === 0) return sendResponse(res, 404, "error", "No valid Vietnamese books found.");

    console.log(`✅ Found ${validWorkIds.length} valid candidates.`);
    
    const results: ProcessResult[] = [];
    for (let i = 0; i < validWorkIds.length; i += MAX_CONCURRENCY) {
        const chunk = validWorkIds.slice(i, i + MAX_CONCURRENCY);
        const chunkRes = await Promise.all(chunk.map(wid => processVietnameseWork(wid)));
        results.push(...chunkRes);
        await sleep(200);
    }

    const success = results.filter(r => r.status === "fulfilled");
    const failed = results.filter(r => r.status === "rejected");

    return sendResponse(res, 200, "success", {
        stats: {
           pages: toPage - fromPage + 1,
           scanned: totalScanned,
           valid: validWorkIds.length,
           success: success.length,
           failed: failed.length
        },
        data: success.map(r => r.value?.data),
        failed: failed.map(r => ({ work: r.work_olid, reason: r.reason }))
    });

  } catch (err: any) {
    return sendResponse(res, 500, "error", err.message);
  }
};
