// src/controllers/book.import.controller.ts
import { Request, Response } from "express";
import { prisma } from "configs/client";

// ================= CONFIGURATION =================
const MAX_CONCURRENCY = 5;
const RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ================= HELPERS: FETCHING =================
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJSON<T = any>(url: string, attempt = 1): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

// ================= HELPERS: DATABASE (UPSERT LOGIC) =================

// 1. Xử lý Tác giả
async function ensureAuthor(authorKey?: string): Promise<number> {
  let name = "Unknown Author";
  let bio = "";

  if (authorKey) {
    try {
      const olId = authorKey.split("/").pop();
      const data = await getJSON(
        `https://openlibrary.org/authors/${olId}.json`
      );
      name = data.name || name;
      bio = typeof data.bio === "string" ? data.bio : data.bio?.value || "";
      if (bio.length > 60000) bio = bio.substring(0, 60000) + "...";
    } catch (e) {
      // console.warn(`Failed to fetch author ${authorKey}, using default.`);
    }
  }

  const record = await prisma.author.upsert({
    where: { name: name },
    update: {},
    create: {
      name: name,
      bio: bio || null,
    },
  });
  return record.id;
}

// 2. Xử lý Nhà xuất bản
async function ensurePublisher(pubName?: string): Promise<number> {
  const name = pubName ? pubName.trim() : "Unknown Publisher";

  const record = await prisma.publisher.upsert({
    where: { name: name },
    update: {},
    create: {
      name: name,
      description: "Imported from OpenLibrary",
    },
  });
  return record.id;
}

// 3. Xử lý Thể loại
async function ensureGenres(subjects: string[]): Promise<number[]> {
  if (!subjects || subjects.length === 0) return [];

  const candidates = subjects.slice(0, 3);
  const ids: number[] = [];

  for (const sub of candidates) {
    const name = sub.trim();
    if (!name) continue;

    try {
      const record = await prisma.genre.upsert({
        where: { name: name },
        update: {},
        create: {
          name: name,
          description: `Books related to ${name}`,
        },
      });
      ids.push(record.id);
    } catch (e) {
      // Ignore errors
    }
  }
  return ids;
}

// ================= HELPERS: DATA CLEANING =================
function pickText(x: any): string {
  if (typeof x === "string") return x;
  if (typeof x?.value === "string") return x.value;
  return "";
}

function ensureShortDesc(text: string | null | undefined): string {
  if (!text || !text.trim()) return "N/A";

  const cleanText = text.trim();
  if (cleanText.length <= 255) {
    return cleanText;
  }

  const HARD_LIMIT = 252;
  let truncated = cleanText.slice(0, HARD_LIMIT);
  const lastSpaceIndex = truncated.lastIndexOf(" ");

  if (lastSpaceIndex > 0) {
    truncated = truncated.slice(0, lastSpaceIndex);
  }

  return truncated + "...";
}

// ================= MAIN CONTROLLER =================
export const createBooksFromOpenLibrary = async (
  req: Request,
  res: Response
) => {
  try {
    const body = req.body ?? {};
    const worksInput: string[] = Array.isArray(body.works) ? body.works : [];

    if (worksInput.length === 0) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp mảng 'works' (VD: ['OL123W'])" });
    }

    const results: any[] = [];

    // Hàm xử lý từng WorkID
    const processWork = async (workId: string) => {
      try {
        // --- BƯỚC 1: FETCH ---
        const workUrl = `https://openlibrary.org/works/${workId}.json`;
        const workData = await getJSON(workUrl);

        const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=1`;
        const edsData = await getJSON(edsUrl);
        const edition = edsData.entries?.[0];

        if (!edition) throw new Error("No edition found");

        // --- BƯỚC 2: PREPARE DATA ---
        const title = edition.title || workData.title || "Untitled";
        const isbn = (
          edition.isbn_13?.[0] ||
          edition.isbn_10?.[0] ||
          `OL-${workId}`
        ).trim();

        // Chuẩn bị response structure cho phần source
        const sourceInfo = {
          work_olid: workId,
          edition_olid: edition.key?.split("/").pop(),
          openlibrary_work_url: workUrl,
        };

        // Check existing
        const existing = await prisma.book.findUnique({ where: { isbn } });
        if (existing) {
          return {
            status: "fulfilled" as const,
            value: {
              source: sourceInfo,
              data: existing,
              note: "Already exists (Skipped creation)",
            },
          };
        }

        const descRaw =
          pickText(workData.description) ||
          pickText(edition.description) ||
          "No description available.";
        const detailDesc = descRaw;
        const shortDesc = ensureShortDesc(detailDesc);

        const pages = edition.number_of_pages || 0;
        const publishDate = edition.publish_date
          ? new Date(edition.publish_date)
          : null;
        const validDate =
          !publishDate || isNaN(publishDate.getTime())
            ? new Date()
            : publishDate;

        const coverId = edition.covers?.[0] || workData.covers?.[0];
        const image = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
          : null;

        // --- BƯỚC 3: RELATIONS ---
        const authorKey = workData.authors?.[0]?.author?.key;
        const authorId = await ensureAuthor(authorKey);

        const publisherName = edition.publishers?.[0];
        const publisherId = await ensurePublisher(publisherName);

        const subjects = workData.subjects || [];
        const genreIds = await ensureGenres(subjects);

        // --- BƯỚC 4: CREATE DB ---
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
              language: "eng",
              pages,
              authors: { connect: { id: authorId } },
              publishers: { connect: { id: publisherId } },
              genres: {
                create: genreIds.map((gid) => ({
                  genreId: gid,
                })),
              },
            },
          });

          const copiesData = Array.from({ length: quantity }).map((_, i) => ({
            bookId: book.id,
            year_published: validDate.getFullYear(),
            copyNumber: `CP-${book.id}-${i + 1}`,
            status: "AVAILABLE",
            location: "Shelf A1",
          }));

          await tx.bookcopy.createMany({ data: copiesData });
          return book;
        });

        // --- SUCCESS RETURN ---
        return {
          status: "fulfilled" as const,
          value: {
            source: sourceInfo,
            data: newBook,
          },
        };
      } catch (err: any) {
        // --- ERROR RETURN ---
        return {
          status: "rejected" as const,
          reason: err.message || "Unknown error",
          work_olid: workId,
        };
      }
    };

    // Chạy batch/chunk để giới hạn concurrency
    for (let i = 0; i < worksInput.length; i += MAX_CONCURRENCY) {
      const chunk = worksInput.slice(i, i + MAX_CONCURRENCY);
      const promises = chunk.map((wid) => processWork(wid));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    // --- THAY ĐỔI CHÍNH Ở ĐÂY ---
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    // Chỉ lấy những kết quả thành công và unwrap (lấy phần value bên trong)
    // để API trả về gọn gàng hơn
    const successData = results
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);

    return res.status(200).json({
      stats: {
        total: worksInput.length,
        success: successCount,
        failed: failedCount,
      },
      data: successData, // Chỉ trả về dữ liệu thành công
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
