// src/controllers/book.import.controller.ts
import { Request, Response } from "express";
import { prisma } from "configs/client";
import { handlePostBook } from "services/book.services";

// ====== Cấu hình: quan hệ fix cứng để test (GIỮ NGUYÊN RANDOM) ======
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const getRandomIDs = () => {
  let array: string[] = [];
  const randomLength = randInt(1, 5);
  for (let i = 0; i < randomLength; i++) {
    let arrayItem = randInt(i, 49);
    array.push(`${arrayItem}`);
    if (array.length === randomLength) return array;
  }
  return array;
};

const DEFAULT_AUTHOR_ID = randInt(4, 100);
const DEFAULT_PUBLISHER_ID = randInt(4, 38);
const DEFAULT_GENRE_IDS = getRandomIDs();

// ================= Helpers =================
const EDITIONS_LIMIT = 200;
const EDITIONS_MAX_PAGES = 5; // tối đa 1000 editions/works
const DEFAULT_CONCURRENCY = 12; // có thể truyền qua body.maxConcurrency
const MAX_CONCURRENCY = 24;
const RETRIES = 3;
const RETRY_BASE_MS = 700;
const quantity = randInt(4, 50);
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJSON<T = any>(url: string, attempt = 1): Promise<T> {
  const r = await fetch(url, {
    headers: { "User-Agent": "LMS/1.0", Accept: "application/json" },
  });
  if (!r.ok) {
    if ((r.status === 429 || r.status >= 500) && attempt < RETRIES) {
      const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await sleep(backoff);
      return getJSON<T>(url, attempt + 1);
    }
    throw new Error(`OpenLibrary error ${r.status}: ${url}`);
  }
  return (await r.json()) as T;
}

function pickText(x: any): string | undefined {
  if (!x) return undefined;
  if (typeof x === "string") return x.trim();
  if (typeof x?.value === "string") return x.value.trim();
  return undefined;
}

// cắt ngắn 1/5 text, giữ biên từ, min/max để hợp với cột shortDesc (<= 255)
function shortOneFifth(s: string, minChars = 80, maxChars = 255): string {
  const len = s?.length || 0;
  if (!len) return "N/A";
  const target = Math.ceil(len / 5);
  const n = Math.max(minChars, Math.min(target, maxChars));
  let out = s.slice(0, n);
  const cut = out.lastIndexOf(" ");
  if (cut > Math.floor(n * 0.6)) out = out.slice(0, cut);
  if (out.length < s.length) out = out.trimEnd() + "…";
  return out;
}

function normalizeLangKey(v?: string): string | undefined {
  if (!v) return undefined; // "/languages/eng" -> "eng"
  const i = v.lastIndexOf("/");
  return i >= 0 ? v.slice(i + 1).trim() : v.trim();
}

function parseIntMaybe(s?: any): number | undefined {
  if (typeof s === "number") return s;
  if (!s || typeof s !== "string") return undefined;
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

function tryParseDate(d?: string): Date | undefined {
  if (!d) return undefined;
  const onlyYear = /^\d{4}$/.test(d.trim());
  if (onlyYear) return new Date(`${d}-01-01T00:00:00Z`);
  const ms = Date.parse(d);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

function coverFromIds(coverIds?: number[], size: "S" | "M" | "L" = "L") {
  if (!coverIds || coverIds.length === 0) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverIds[0]}-${size}.jpg`;
}

function coverFromIsbn(isbn?: string, size: "S" | "M" | "L" = "L") {
  if (!isbn) return undefined;
  return `https://covers.openlibrary.org/isbn/${isbn}-${size}.jpg`;
}

type EditionEntry = {
  key: string; // "/books/OLxxxxM"
  title?: string;
  number_of_pages?: number;
  pagination?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  languages?: { key: string }[];
  publish_date?: string;
  publishers?: string[];
  covers?: number[];
  description?: string | { value?: string };
};

// Ưu tiên edition có ISBN-13, có pages/language, rồi fallback ISBN-10
function chooseBestEdition(
  entries: EditionEntry[] = []
): EditionEntry | undefined {
  if (!entries.length) return undefined;
  const score = (e: EditionEntry) => {
    let s = 0;
    if (e.isbn_13?.length) s += 10;
    if (e.isbn_10?.length) s += 5;
    if (typeof e.number_of_pages === "number") s += 2;
    if (e.languages?.length) s += 2;
    if (e.publishers?.length) s += 1;
    if (e.covers?.length) s += 1;
    return s;
  };
  return [...entries].sort((a, b) => score(b) - score(a))[0];
}

// Lấy nhiều editions theo trang để tăng xác suất tìm ISBN
async function fetchAllEditions(workId: string): Promise<EditionEntry[]> {
  const all: EditionEntry[] = [];
  for (let page = 0; page < EDITIONS_MAX_PAGES; page++) {
    const offset = page * EDITIONS_LIMIT;
    const eds = await getJSON<{ entries?: EditionEntry[] }>(
      `https://openlibrary.org/works/${workId}/editions.json?limit=${EDITIONS_LIMIT}&offset=${offset}`
    );
    const entries = eds?.entries || [];
    if (!entries.length) break;
    all.push(...entries);
    // nếu đã có kha khá editions và đã gặp vài cái có isbn_13 -> dừng sớm
    if (all.length >= 400 && all.some((e) => e.isbn_13?.length)) break;
  }
  return all;
}

// Promise pool giới hạn concurrency
async function mapLimit<T, U>(
  arr: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const ret: U[] = [];
  let i = 0;
  const run = async () => {
    while (true) {
      const cur = i++;
      if (cur >= arr.length) break;
      ret[cur] = await mapper(arr[cur], cur);
    }
  };
  const workers = Array.from({ length: Math.min(limit, arr.length) }, run);
  await Promise.all(workers);
  return ret;
}
const PRICE_MIN = 100_000;
const PRICE_MAX = 1_500_000;

// ================= Controller =================
export const createBooksFromOpenLibrary = async (
  req: Request,
  res: Response
) => {
  try {
    const body = req.body ?? {};
    if (!Array.isArray(body.works) || body.works.length === 0) {
      throw new Error(
        `Body phải có "works": string[] (ví dụ: { "works": ["OL66554W"] }).`
      );
    }

    // Chuẩn hóa input & loại trùng
    const works: any = [
      ...new Set(body.works.map((s: any) => String(s).trim()).filter(Boolean)),
    ];

    // Nếu muốn đảm bảo 1 lần phải xử lý ≥100 IDs, hãy truyền vào ít nhất 100 workId ở body.
    // Ở đây controller đã song song hóa để đáp ứng tốt lượng lớn.
    const defaultPrice: number = randInt(PRICE_MIN, PRICE_MAX);
    const defaultQuantity: number = quantity;
    const maxConcurrency: number = Math.max(
      1,
      Math.min(MAX_CONCURRENCY, +body.maxConcurrency || DEFAULT_CONCURRENCY)
    );

    const results = await mapLimit(works, maxConcurrency, async (workId) => {
      try {
        // 1) Work
        const work = await getJSON<any>(
          `https://openlibrary.org/works/${workId}.json`
        );
        const workTitle: string | undefined = work?.title?.trim();
        const workDesc: string | undefined = pickText(work?.description);
        const detailDesc: string =
          workDesc && workDesc.length ? workDesc : "N/A";
        const shortDesc: string =
          detailDesc === "N/A" ? "N/A" : shortOneFifth(detailDesc);

        // 2) Editions (phân trang, limit=200)
        const allEds = await fetchAllEditions(workId as any);
        const best = chooseBestEdition(allEds);
        if (!best)
          throw new Error(`Không tìm thấy edition phù hợp cho work ${workId}.`);

        const isbn = best.isbn_13?.[0] ?? best.isbn_10?.[0];
        if (!isbn) throw new Error(`Edition không có ISBN cho work ${workId}.`);

        // 3) Tránh trùng
        const existed = await prisma.book.findUnique({ where: { isbn } });
        if (existed) {
          return {
            status: "fulfilled" as const,
            value: {
              source: {
                work_olid: workId,
                edition_olid: best.key?.split("/").pop(),
                openlibrary_work_url: `https://openlibrary.org/works/${workId}`,
              },
              data: existed,
              note: "Đã tồn tại (ISBN trùng).",
            },
          };
        }

        const pages =
          typeof best.number_of_pages === "number"
            ? best.number_of_pages
            : parseIntMaybe(best.pagination) ?? 0;

        const language =
          normalizeLangKey(best.languages?.[0]?.key) ||
          (Array.isArray(work?.languages)
            ? normalizeLangKey(work.languages[0]?.key)
            : undefined) ||
          "und";

        const publishDate =
          tryParseDate(best.publish_date) ||
          (typeof work?.first_publish_date === "string"
            ? tryParseDate(work.first_publish_date)
            : undefined) ||
          new Date("1970-01-01T00:00:00Z");

        const title: string = (best.title || workTitle || "Untitled").trim();

        const image =
          coverFromIds(best.covers) ||
          coverFromIds(work?.covers) ||
          coverFromIsbn(isbn) ||
          "";

        // 4) Tạo Book (GIỮ NGUYÊN CÁCH RANDOM QUAN HỆ)
        const created = await handlePostBook(
          isbn,
          title,
          shortDesc,
          detailDesc,
          defaultPrice,
          defaultQuantity,
          pages,
          publishDate,
          language,
          DEFAULT_AUTHOR_ID, // random đã có sẵn
          DEFAULT_PUBLISHER_ID, // random đã có sẵn
          DEFAULT_GENRE_IDS, // random đã có sẵn
          image
        );

        return {
          status: "fulfilled" as const,
          value: {
            source: {
              work_olid: workId,
              edition_olid: best.key?.split("/").pop(),
              openlibrary_work_url: `https://openlibrary.org/works/${workId}`,
            },
            data: created,
          },
        };
      } catch (reason: any) {
        return {
          status: "rejected" as const,
          reason: reason?.message || String(reason),
        };
      }
    });

    const data = results
      .map((r) => (r.status === "fulfilled" ? (r as any).value : null))
      .filter(Boolean);
    const failed = results
      .map((r, i) =>
        r.status === "rejected"
          ? { work_olid: works[i], error: (r as any).reason }
          : null
      )
      .filter(Boolean);

    return res.status(201).json({
      data,
      failed,
      stats: {
        requested: works.length,
        created: data.length,
        failed: failed.length,
        concurrency: maxConcurrency,
      },
    });
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || String(err), data: null });
  }
};
