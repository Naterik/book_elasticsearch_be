import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";

// ================= CONFIGURATION =================
const MAX_CONCURRENCY = 20;
const RETRIES = 3;
const RETRY_BASE_MS = 1000;

// New config for subject-based generation / validation
const MAX_WORKS_PER_REQUEST = 2000; // hard limit to protect server
const SUBJECT_API_PAGE_LIMIT = 2000; // how many works to request from subject endpoint
const EDITION_CHECK_CONCURRENCY = 10; // concurrency when verifying editions from subject

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

// ================= HELPER: SUBJECT → VALID WORK IDS =================
// Fetches works from a subject and returns only work IDs that have at least one edition.
async function getValidWorkIdsFromSubject(
  subject: string,
  desiredLimit = 2000
): Promise<string[]> {
  if (!subject) return [];
  // request up to SUBJECT_API_PAGE_LIMIT but not exceeding desiredLimit too much
  const fetchLimit = Math.min(
    Math.max(desiredLimit, 100),
    SUBJECT_API_PAGE_LIMIT
  );
  const subjectUrl = `https://openlibrary.org/subjects/${encodeURIComponent(
    subject
  )}.json?limit=${fetchLimit}`;

  const data: any = await getJSON(subjectUrl);
  if (!data?.works || !Array.isArray(data.works)) return [];

  const workIds = data.works
    .map((w: any) =>
      typeof w.key === "string" ? w.key.split("/").pop() : null
    )
    .filter(Boolean) as string[];

  // verify each work has at least one edition (the controller requires edition)
  const uniqueIds = Array.from(new Set(workIds));
  const validIds: string[] = [];

  // concurrency-limited edition checks
  for (let i = 0; i < uniqueIds.length; i += EDITION_CHECK_CONCURRENCY) {
    const chunk = uniqueIds.slice(i, i + EDITION_CHECK_CONCURRENCY);
    const checks = await Promise.all(
      chunk.map(async (wid) => {
        try {
          const edsUrl = `https://openlibrary.org/works/${wid}/editions.json?limit=1`;
          const edsData: any = await getJSON(edsUrl);
          if (edsData?.entries && edsData.entries.length > 0) return wid;
        } catch (e) {
          // swallow: treat as invalid for now
        }
        return null;
      })
    );

    checks.forEach((x) => {
      if (x) validIds.push(x);
    });

    // small sleep to reduce the chance of hitting rate limits on big requests
    await sleep(100);
  }

  return validIds;
}

// ================= HELPERS: CACHING & DATABASE =================
const requestCache = {
  authors: new Map<string, number>(),
  publishers: new Map<string, number>(),
  genres: new Map<string, number>(),
  subjects: new Map<string, number>(),
};

// 1. Xử lý Tác giả (Có Cache)
async function ensureAuthor(name: string, bio: string): Promise<number> {
  if (requestCache.authors.has(name)) {
    return requestCache.authors.get(name)!;
  }

  const record = await prisma.author.upsert({
    where: { name: name },
    update: {},
    create: { name, bio: bio || null },
  });

  requestCache.authors.set(name, record.id);
  return record.id;
}

// 2. Xử lý Nhà xuất bản (Có Cache)
async function ensurePublisher(name: string): Promise<number> {
  const cleanName = name ? name.trim() : "Unknown Publisher";

  if (requestCache.publishers.has(cleanName)) {
    return requestCache.publishers.get(cleanName)!;
  }

  const record = await prisma.publisher.upsert({
    where: { name: cleanName },
    update: {},
    create: {
      name: cleanName,
      description: "Imported from OpenLibrary",
    },
  });

  requestCache.publishers.set(cleanName, record.id);
  return record.id;
}

// 3. Xử lý Thể loại (Có Cache)
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
        where: { name: name },
        update: {},
        create: {
          name: name,
          description: `Books related to ${name}`,
        },
      });
      requestCache.genres.set(name, record.id);
      ids.push(record.id);
    } catch (e) {
      // Ignore errors
    }
  }
  return ids;
}

// 4. Xử lý Subject (Subject từ OpenLibrary - mới thêm)
interface SubjectRecord {
  id: number;
  name: string;
  workIds: string[];
  count: number;
}

async function ensureSubject(
  name: string,
  workIds: string[] = []
): Promise<number> {
  if (requestCache.subjects.has(name)) {
    return requestCache.subjects.get(name)!;
  }

  try {
    const record = await prisma.genre.upsert({
      where: { name: name },
      update: {},
      create: {
        name: name,
        description: `Subject: ${name} (from OpenLibrary) - ${workIds.length} works`,
      },
    });
    requestCache.subjects.set(name, record.id);
    return record.id;
  } catch (e) {
    return -1;
  }
}

async function importSubjectsFromWorks(
  workIds: string[]
): Promise<SubjectRecord[]> {
  const subjectMap = new Map<string, Set<string>>();

  for (let i = 0; i < workIds.length; i += MAX_CONCURRENCY) {
    const chunk = workIds.slice(i, i + MAX_CONCURRENCY);

    const results = await Promise.all(
      chunk.map(async (workId) => {
        try {
          const workUrl = `https://openlibrary.org/works/${workId}.json`;
          const workData = await getJSON(workUrl);
          const subjects = workData.subjects || [];
          return { workId, subjects };
        } catch (e) {
          return { workId, subjects: [] };
        }
      })
    );

    results.forEach(({ workId, subjects }) => {
      subjects.forEach((subject: string) => {
        const subName = subject.trim();
        if (!subName) return;
        if (!subjectMap.has(subName)) {
          subjectMap.set(subName, new Set());
        }
        subjectMap.get(subName)!.add(workId);
      });
    });

    await sleep(50);
  }

  const savedSubjects: SubjectRecord[] = [];
  for (const [subjectName, workIdSet] of subjectMap.entries()) {
    const workIdsArray = Array.from(workIdSet);
    const id = await ensureSubject(subjectName, workIdsArray);
    if (id !== -1) {
      savedSubjects.push({
        id,
        name: subjectName,
        workIds: workIdsArray,
        count: workIdsArray.length,
      });
    }
  }
  return savedSubjects;
}

// ================= HELPERS: LOCATION & STATUS =================
let locationCounter = 0;

function getNextLocation(): string {
  // 26 chữ cái * 100 vị trí = 2600 slots
  const totalSlots = 26 * 100;
  const current = locationCounter % totalSlots;

  // Tính toán chữ cái (A-Z)
  const letterIndex = Math.floor(current / 100);
  const letter = String.fromCharCode(65 + letterIndex); // 65 là mã ASCII của 'A'

  // Tính toán số (1-100)
  const number = (current % 100) + 1;

  locationCounter++;
  return `Shelf ${letter}${number}`;
}

function getRandomStatus(): string {
  const statuses = ["AVAILABLE", "ON_LOAN", "ON_HOLD", "LOST"];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// ================= HELPERS: DATA CLEANING =================
function pickText(x: any): string {
  if (typeof x === "string") return x;
  if (typeof x?.value === "string") return x.value;
  return "";
}

// ================= PROCESS WORK (Shared) =================
async function processWork(workId: string) {
  try {
    // --- BƯỚC 1: PARALLEL FETCH (Tối ưu mạng) ---
    const workUrl = `https://openlibrary.org/works/${workId}.json`;
    const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=1`;

    // Gọi song song Work và Edition
    const [workData, edsData] = await Promise.all([
      getJSON(workUrl),
      getJSON(edsUrl),
    ]);

    const edition = edsData.entries?.[0];
    if (!edition) throw new Error("No edition found");

    // --- BƯỚC 2: FETCH AUTHOR (Nếu có) ---
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
      } catch (e) {
        // ignore author fetch error
      }
    }

    // --- BƯỚC 3: PREPARE DATA ---
    const title = edition.title || workData.title || "Untitled";
    const isbn = (
      edition.isbn_13?.[0] ||
      edition.isbn_10?.[0] ||
      `OL-${workId}`
    ).trim();

    const sourceInfo = {
      work_olid: workId,
      edition_olid: edition.key?.split("/").pop(),
      openlibrary_work_url: workUrl,
    };

    // Check existing (Nhanh hơn nếu check trước khi xử lý sâu)
    const existing = await prisma.book.findUnique({ where: { isbn } });
    if (existing) {
      return {
        status: "fulfilled" as const,
        value: {
          source: sourceInfo,
          data: existing,
          note: "Already exists",
        },
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

    // --- BƯỚC 4: DB METADATA (Dùng Cache để tối ưu) ---
    // Chạy song song các tác vụ upsert metadata
    const [authorId, publisherId, genreIds] = await Promise.all([
      ensureAuthor(authorName, authorBio),
      ensurePublisher(edition.publishers?.[0]),
      ensureGenres(workData.subjects || []),
    ]);

    // --- BƯỚC 5: CREATE BOOK & COPIES ---
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
            create: genreIds.map((gid) => ({ genreId: gid })),
          },
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
      status: "fulfilled" as const,
      value: { source: sourceInfo, data: newBook },
    };
  } catch (err: any) {
    return {
      status: "rejected" as const,
      reason: err.message || "Unknown error",
      work_olid: workId,
    };
  }
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

// ================= AUTO IMPORT FROM SPECIFIC GENRES LIST =================
/**
 * Tự động import sách từ danh sách genre cụ thể
 * Không cần genre phải tồn tại trong database
 */
export const autoImportBooksFromGenresList = async (
  req: Request,
  res: Response
) => {
  try {
    // Reset cache mỗi request mới
    requestCache.authors.clear();
    requestCache.publishers.clear();
    requestCache.genres.clear();
    requestCache.subjects.clear();

    const body = req.body ?? {};
    let genresList: string[] = Array.isArray(body.genres) ? body.genres : [];
    const booksPerGenre: number =
      typeof body.booksPerGenre === "number"
        ? Math.min(body.booksPerGenre, 1000)
        : 50;

    if (genresList.length === 0) {
      return sendResponse(res, 400, "error", "Vui lòng cung cấp mảng 'genres' và optional 'booksPerGenre' (mặc định: 50)", {
        example: {
          genres: ["art", "music", "cooking"],
          booksPerGenre: 50,
        },
      });
    }

    // Chuẩn hóa genre list
    genresList = Array.from(
      new Set(genresList.map((g) => String(g).trim().toLowerCase()))
    );

    console.log(`📚 Bắt đầu auto-import từ ${genresList.length} thể loại`);

    const allResults: any[] = [];
    const genreStats: any[] = [];

    // Xử lý từng genre
    for (const genreName of genresList) {
      try {
        console.log(`\n🔍 Xử lý thể loại: ${genreName}`);

        // Lấy danh sách WorkID từ subject
        const genreWorkIds = await getValidWorkIdsFromSubject(
          genreName,
          booksPerGenre
        );

        if (genreWorkIds.length === 0) {
          console.log(`⚠️  Không tìm thấy sách cho thể loại: ${genreName}`);
          genreStats.push({
            genre: genreName,
            requested: 0,
            success: 0,
            failed: 0,
          });
          continue;
        }

        console.log(
          `✅ Tìm thấy ${genreWorkIds.length} sách cho: ${genreName}`
        );

        const genreResults: any[] = [];

        // Xử lý từng WorkID trong genre
        for (let i = 0; i < genreWorkIds.length; i += MAX_CONCURRENCY) {
          const chunk = genreWorkIds.slice(i, i + MAX_CONCURRENCY);
          const promises = chunk.map((wid) => processWork(wid));
          const chunkResults = await Promise.all(promises);
          genreResults.push(...chunkResults);
        }

        const genreSuccess = genreResults.filter(
          (r) => r.status === "fulfilled"
        ).length;
        const genreFailed = genreResults.filter(
          (r) => r.status === "rejected"
        ).length;

        console.log(
          `📊 ${genreName}: ${genreSuccess} thành công, ${genreFailed} thất bại`
        );

        genreStats.push({
          genre: genreName,
          requested: genreWorkIds.length,
          success: genreSuccess,
          failed: genreFailed,
        });

        allResults.push(...genreResults);

        // Delay giữa các genre để tránh rate limit
        await sleep(500);
      } catch (err: any) {
        console.error(`❌ Lỗi khi xử lý genre ${genreName}:`, err.message);
        genreStats.push({
          genre: genreName,
          requested: 0,
          success: 0,
          failed: 0,
          error: err.message,
        });
      }
    }

    const successCount = allResults.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const failedCount = allResults.filter(
      (r) => r.status === "rejected"
    ).length;
    const successData = allResults
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);

    // Import subject từ sách thành công
    let importedSubjects: SubjectRecord[] = [];
    if (successCount > 0) {
      try {
        const successWorkIds = successData.map(
          (item: any) => item.source.work_olid
        );
        importedSubjects = await importSubjectsFromWorks(successWorkIds);
      } catch (e) {
        console.warn("Failed to import subjects:", e);
      }
    }

    console.log(
      `\n✅ Auto-import hoàn tất: ${successCount} sách thêm, ${failedCount} thất bại`
    );

    return sendResponse(res, 200, "success", {
      stats: {
        total_genres_requested: genresList.length,
        total_books_requested: allResults.length,
        total_success: successCount,
        total_failed: failedCount,
        imported_subjects: importedSubjects.length,
      },
      genre_stats: genreStats,
      data: successData,
      subjects: importedSubjects,
    });
  } catch (err: any) {
    console.error("Auto-import error:", err);
    return sendResponse(res, 500, "error", err.message, null);
  }
};

// ================= AUTO IMPORT FROM EXISTING GENRES =================
/**
 * Tự động import sách từ tất cả các Genre (Thể loại) hiện có trong database
 * Không cần truyền qua Postman, tự động quét tất cả Genre và tìm sách
 */
export const autoImportBooksFromGenres = async (
  req: Request,
  res: Response
) => {
  try {
    // Reset cache mỗi request mới
    requestCache.authors.clear();
    requestCache.publishers.clear();
    requestCache.genres.clear();
    requestCache.subjects.clear();

    // Lấy tất cả genre từ database
    const allGenres = await prisma.genre.findMany({
      select: { id: true, name: true },
    });

    if (allGenres.length === 0) {
      return sendResponse(res, 400, "error", "Không có thể loại nào trong database. Vui lòng thêm thể loại trước.", null);
    }

    console.log(`📚 Bắt đầu auto-import từ ${allGenres.length} thể loại`);

    const allResults: any[] = [];
    const genreStats: any[] = [];

    // Xử lý từng genre
    for (const genre of allGenres) {
      try {
        console.log(`\n🔍 Xử lý thể loại: ${genre.name}`);

        // Lấy danh sách WorkID từ subject
        const genreWorkIds = await getValidWorkIdsFromSubject(genre.name, 50); // 50 sách/genre

        if (genreWorkIds.length === 0) {
          console.log(`⚠️  Không tìm thấy sách cho thể loại: ${genre.name}`);
          genreStats.push({
            genre: genre.name,
            requested: 0,
            success: 0,
            failed: 0,
          });
          continue;
        }

        console.log(
          `✅ Tìm thấy ${genreWorkIds.length} sách cho: ${genre.name}`
        );

        const genreResults: any[] = [];

        // Xử lý từng WorkID trong genre
        for (let i = 0; i < genreWorkIds.length; i += MAX_CONCURRENCY) {
          const chunk = genreWorkIds.slice(i, i + MAX_CONCURRENCY);
          const promises = chunk.map((wid) => processWork(wid));
          const chunkResults = await Promise.all(promises);
          genreResults.push(...chunkResults);
        }

        const genreSuccess = genreResults.filter(
          (r) => r.status === "fulfilled"
        ).length;
        const genreFailed = genreResults.filter(
          (r) => r.status === "rejected"
        ).length;

        console.log(
          `📊 ${genre.name}: ${genreSuccess} thành công, ${genreFailed} thất bại`
        );

        genreStats.push({
          genre: genre.name,
          requested: genreWorkIds.length,
          success: genreSuccess,
          failed: genreFailed,
        });

        allResults.push(...genreResults);

        // Delay giữa các genre để tránh rate limit
        await sleep(500);
      } catch (err: any) {
        console.error(`❌ Lỗi khi xử lý genre ${genre.name}:`, err.message);
        genreStats.push({
          genre: genre.name,
          requested: 0,
          success: 0,
          failed: 0,
          error: err.message,
        });
      }
    }

    const successCount = allResults.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const failedCount = allResults.filter(
      (r) => r.status === "rejected"
    ).length;
    const successData = allResults
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);

    // Import subject từ sách thành công
    let importedSubjects: SubjectRecord[] = [];
    if (successCount > 0) {
      try {
        const successWorkIds = successData.map(
          (item: any) => item.source.work_olid
        );
        importedSubjects = await importSubjectsFromWorks(successWorkIds);
      } catch (e) {
        console.warn("Failed to import subjects:", e);
      }
    }

    console.log(
      `\n✅ Auto-import hoàn tất: ${successCount} sách thêm, ${failedCount} thất bại`
    );

    return sendResponse(res, 200, "success", {
      stats: {
        total_genres: allGenres.length,
        total_books_requested: allResults.length,
        total_success: successCount,
        total_failed: failedCount,
        imported_subjects: importedSubjects.length,
      },
      genre_stats: genreStats,
      data: successData,
      subjects: importedSubjects,
    });
  } catch (err: any) {
    console.error("Auto-import error:", err);
    return sendResponse(res, 500, "error", err.message, null);
  }
};

// ================= MAIN CONTROLLER =================
export const createBooksFromOpenLibrary = async (
  req: Request,
  res: Response
) => {
  try {
    // Reset cache mỗi request mới
    requestCache.authors.clear();
    requestCache.publishers.clear();
    requestCache.genres.clear();
    requestCache.subjects.clear();

    const body = req.body ?? {};
    let worksInput: string[] = Array.isArray(body.works) ? body.works : [];

    const requestedSubject: string | undefined =
      typeof body.subject === "string" ? body.subject : undefined;
    const requestedLimit: number =
      typeof body.limit === "number"
        ? Math.max(0, Math.floor(body.limit))
        : 500;

    let generatedFromSubject = false;
    if (
      (worksInput.length === 0 || worksInput.every((w) => !w)) &&
      requestedSubject
    ) {
      const desired = Math.min(requestedLimit, MAX_WORKS_PER_REQUEST);
      const generated = await getValidWorkIdsFromSubject(
        requestedSubject,
        desired
      );
      worksInput = generated.slice(0, desired);
      generatedFromSubject = true;
    }

    if (worksInput.length > MAX_WORKS_PER_REQUEST) {
      worksInput = worksInput.slice(0, MAX_WORKS_PER_REQUEST);
    }

    if (worksInput.length === 0) {
      return sendResponse(res, 400, "error", "Vui lòng cung cấp mảng 'works' (VD: ['OL123W']) hoặc 'subject' + optional 'limit'", null);
    }

    worksInput = Array.from(new Set(worksInput.map((w) => String(w).trim())));
    const results: any[] = [];

    // Hàm xử lý từng WorkID
    const processWork = async (workId: string) => {
      try {
        // --- BƯỚC 1: PARALLEL FETCH (Tối ưu mạng) ---
        const workUrl = `https://openlibrary.org/works/${workId}.json`;
        const edsUrl = `https://openlibrary.org/works/${workId}/editions.json?limit=1`;

        // Gọi song song Work và Edition
        const [workData, edsData] = await Promise.all([
          getJSON(workUrl),
          getJSON(edsUrl),
        ]);

        const edition = edsData.entries?.[0];
        if (!edition) throw new Error("No edition found");

        // --- BƯỚC 2: FETCH AUTHOR (Nếu có) ---
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
          } catch (e) {
            // ignore author fetch error
          }
        }

        // --- BƯỚC 3: PREPARE DATA ---
        const title = edition.title || workData.title || "Untitled";
        const isbn = (
          edition.isbn_13?.[0] ||
          edition.isbn_10?.[0] ||
          `OL-${workId}`
        ).trim();

        const sourceInfo = {
          work_olid: workId,
          edition_olid: edition.key?.split("/").pop(),
          openlibrary_work_url: workUrl,
        };

        // Check existing (Nhanh hơn nếu check trước khi xử lý sâu)
        const existing = await prisma.book.findUnique({ where: { isbn } });
        if (existing) {
          return {
            status: "fulfilled" as const,
            value: {
              source: sourceInfo,
              data: existing,
              note: "Already exists",
            },
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
          !publishDate || isNaN(publishDate.getTime())
            ? new Date()
            : publishDate;

        const coverId = edition.covers?.[0] || workData.covers?.[0];
        const image = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
          : null;

        // --- BƯỚC 4: DB METADATA (Dùng Cache để tối ưu) ---
        // Chạy song song các tác vụ upsert metadata
        const [authorId, publisherId, genreIds] = await Promise.all([
          ensureAuthor(authorName, authorBio),
          ensurePublisher(edition.publishers?.[0]),
          ensureGenres(workData.subjects || []),
        ]);

        // --- BƯỚC 5: CREATE BOOK & COPIES ---
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
                create: genreIds.map((gid) => ({ genreId: gid })),
              },
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
          status: "fulfilled" as const,
          value: { source: sourceInfo, data: newBook },
        };
      } catch (err: any) {
        return {
          status: "rejected" as const,
          reason: err.message || "Unknown error",
          work_olid: workId,
        };
      }
    };

    // Chạy batch với concurrency cao
    for (let i = 0; i < worksInput.length; i += MAX_CONCURRENCY) {
      const chunk = worksInput.slice(i, i + MAX_CONCURRENCY);
      const promises = chunk.map((wid) => processWork(wid));
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;
    const successData = results
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);

    let importedSubjects: SubjectRecord[] = [];
    if (successCount > 0) {
      try {
        const successWorkIds = successData.map(
          (item: any) => item.source.work_olid
        );
        importedSubjects = await importSubjectsFromWorks(successWorkIds);
      } catch (e) {
        console.warn("Failed to import subjects:", e);
      }
    }

    return sendResponse(res, 200, "success", {
      stats: {
        total_requested: worksInput.length,
        success: successCount,
        failed: failedCount,
        generatedFromSubject: generatedFromSubject,
        imported_subjects: importedSubjects.length,
      },
      data: successData,
      subjects: importedSubjects,
    });
  } catch (err: any) {
    console.error(err);
    return sendResponse(res, 500, "error", err.message, null);
  }
};
