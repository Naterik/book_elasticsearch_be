import type { Request, Response } from "express";

// Tuỳ chỉnh: bạn có thể rút gọn / thay đổi danh sách subject tuỳ nhu cầu
const DEFAULT_SUBJECTS = [
  "fiction",
  "classics",
  "fantasy",
  "science_fiction",
  "mystery",
  "detective_and_mystery_stories",
  "thriller",
  "horror",
  "romance",
  "historical_fiction",
  "adventure_stories",
  "short_stories",
  "drama",
  "plays",
  "poetry",
  "children",
  "young_adult_fiction",
  "biography",
  "autobiography",
  "history",
  "philosophy",
  "psychology",
  "literary_criticism",
  "essays",
  "travel",
  "humor",
  "war",
  "dystopian_fiction",
  "magic",
  "time_travel",
  "space_opera",
  "epic_fantasy",
  "mythology",
  "fairy_tales",
  "folklore",
  "western",
  "coming_of_age",
  "gothic_fiction",
  "post_apocalyptic",
  "alternate_history",
  "crime",
  "noir",
  "spy_stories",
  "political_fiction",
  "satire",
  "urban_fantasy",
  "paranormal",
  "ghost_stories",
  "steampunk",
  "cyberpunk",
  "high_fantasy",
  "low_fantasy",
  "classic_literature",
  "modern_classics",
  "literary_fiction",
];

const PAGE_SIZE = 200; // hợp lý cho endpoint subjects
const MAX_PAGES_PER_SUBJECT = 6; // tối đa ~1200/subject nếu cần
const DEFAULT_TARGET = 1000; // số lượng work id mặc định
const MAX_TARGET = 10000; // chặn ngưỡng quá lớn

type Body = {
  target?: number; // số lượng cần lấy (mặc định 1000)
  subjects?: string[]; // danh sách subject (tuỳ chọn)
  excludeWorks?: string[]; // danh sách Work ID cần loại trừ (tuỳ chọn)
};

function isValidWorkId(id: string | null | undefined): id is string {
  return typeof id === "string" && /^OL\d+W$/i.test(id);
}

function extractWorkId(workKey: unknown): string | null {
  // work.key dạng "/works/OL12345W" -> "OL12345W"
  if (typeof workKey !== "string") return null;
  const m = workKey.match(/\/works\/(OL\d+W)/i);
  return m ? m[1] : null;
}

async function fetchWithTimeout(url: string, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Open Library khuyến nghị đặt UA có thông tin liên hệ
        "User-Agent":
          "LMS/1.0 (openlibrary works fetch; contact: you@example.com)",
      },
      signal: controller.signal,
    });
    return r;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSubjectPage(subject: string, offset: number) {
  const url = `https://openlibrary.org/subjects/${encodeURIComponent(
    subject
  )}.json?limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) {
    throw new Error(
      `OpenLibrary error ${res.status} (${subject}, offset=${offset})`
    );
  }
  return res.json() as Promise<{ works?: Array<{ key: string }> }>;
}

// ===== Controller chính =====
export const postWorksIdOpen = async (
  req: Request<{}, {}, Body>,
  res: Response
) => {
  const body = req.body || {};
  const need = Math.max(1, Math.min(MAX_TARGET, body.target ?? DEFAULT_TARGET));
  const SUBJECTS =
    Array.isArray(body.subjects) && body.subjects.length > 0
      ? body.subjects
      : DEFAULT_SUBJECTS;

  const excludeSet = new Set<string>(
    (body.excludeWorks || []).filter(isValidWorkId)
  );

  const results = new Set<string>(); // chứa các work id duy nhất (đã khử trùng lặp và loại trừ)

  try {
    // duyệt nhiều subject để đạt đủ số lượng
    outer: for (const subject of SUBJECTS) {
      let offset = 0;
      for (let page = 0; page < MAX_PAGES_PER_SUBJECT; page++) {
        let data: { works?: Array<{ key: string }> } | null = null;
        try {
          data = await fetchSubjectPage(subject, offset);
        } catch {
          // lỗi trang/subject -> bỏ qua sang trang/subject khác
          data = null;
        }

        const list = Array.isArray(data?.works) ? data!.works : [];
        if (list.length === 0) break; // hết dữ liệu subject này

        for (const w of list) {
          const id = extractWorkId(w?.key);
          if (isValidWorkId(id) && !excludeSet.has(id)) {
            results.add(id);
            if (results.size >= need) break outer;
          }
        }
        offset += PAGE_SIZE;
      }
      if (results.size >= need) break;
    }

    // Trả về tối giản: chỉ mảng work ids
    res.status(200).json({ works: Array.from(results).slice(0, need) });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || "Open Library fetch failed",
      works: [],
    });
  }
};
