// src/controllers/book.import.controller.ts
import { Request, Response } from "express";
import { prisma } from "configs/client";
import { handlePostBook } from "services/book.services";

// ====== Cấu hình: quan hệ fix cứng để test ======
const DEFAULT_AUTHOR_ID = 6;
const DEFAULT_PUBLISHER_ID = 6;
const DEFAULT_GENRE_IDS = ["6"]; // handlePostBook nhận string[] | string

// ================= Helpers =================
async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { "User-Agent": "LMS/1.0" } });
  if (!r.ok) throw new Error(`OpenLibrary error ${r.status}: ${url}`);
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
  const len = s.length;
  if (!len) return "N/A";
  const target = Math.ceil(len / 5);
  const n = Math.max(minChars, Math.min(target, maxChars));
  let out = s.slice(0, n);
  // cắt ở khoảng trắng gần cuối để không gãy từ
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
    return s;
  };
  return [...entries].sort((a, b) => score(b) - score(a))[0];
}

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

    const works: string[] = body.works
      .map((s: any) => String(s).trim())
      .filter(Boolean);
    const defaultPrice: number = Number.isFinite(+body.defaultPrice)
      ? +body.defaultPrice
      : 0;
    const defaultQuantity: number = Number.isFinite(+body.defaultQuantity)
      ? +body.defaultQuantity
      : 1;

    const results: Array<{
      status: "fulfilled" | "rejected";
      value?: any;
      reason?: any;
    }> = [];

    for (const workId of works) {
      try {
        // 1) Work: LẤY WORK DESCRIPTION để làm detailDesc
        const work = await getJSON<any>(
          `https://openlibrary.org/works/${workId}.json`
        );
        const workTitle: string | undefined = work?.title?.trim();
        const workDesc: string | undefined = pickText(work?.description); // <<— nguồn chính
        const detailDesc: string =
          workDesc && workDesc.length ? workDesc : "N/A";
        const shortDesc: string =
          detailDesc === "N/A" ? "N/A" : shortOneFifth(detailDesc);

        // 2) Editions: lấy ISBN + pages + language + publish_date + cover
        const eds = await getJSON<{ entries?: EditionEntry[] }>(
          `https://openlibrary.org/works/${workId}/editions.json?limit=50`
        );
        const best = chooseBestEdition(eds?.entries);
        if (!best)
          throw new Error(`Không tìm thấy edition phù hợp cho work ${workId}.`);

        const isbn = best.isbn_13?.[0] ?? best.isbn_10?.[0];
        if (!isbn) throw new Error(`Edition không có ISBN cho work ${workId}.`);

        // 3) Tránh trùng
        const existed = await prisma.book.findUnique({ where: { isbn } });
        if (existed) {
          results.push({
            status: "fulfilled",
            value: {
              source: {
                work_olid: workId,
                edition_olid: best.key?.split("/").pop(),
                openlibrary_work_url: `https://openlibrary.org/works/${workId}`,
              },
              data: existed,
              note: "Đã tồn tại (ISBN trùng).",
            },
          });
          continue;
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

        // 4) Tạo Book: quan hệ fix cứng = 6
        const created = await handlePostBook(
          isbn,
          title,
          shortDesc, // <<— 1/5 detailDesc
          detailDesc, // <<— lấy từ Work Description
          defaultPrice,
          defaultQuantity,
          pages,
          publishDate,
          language,
          DEFAULT_AUTHOR_ID,
          DEFAULT_PUBLISHER_ID,
          DEFAULT_GENRE_IDS,
          image
        );

        results.push({
          status: "fulfilled",
          value: {
            source: {
              work_olid: workId,
              edition_olid: best.key?.split("/").pop(),
              openlibrary_work_url: `https://openlibrary.org/works/${workId}`,
            },
            data: created,
          },
        });

        await new Promise((r) => setTimeout(r, 250));
      } catch (reason) {
        results.push({ status: "rejected", reason });
      }
    }

    const data = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);
    const failed = results
      .map((r, i) =>
        r.status === "rejected"
          ? {
              work_olid: works[i],
              error: (r.reason as any)?.message || String(r.reason),
            }
          : null
      )
      .filter(Boolean);

    return res.status(201).json({ data, failed });
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || String(err), data: null });
  }
};
