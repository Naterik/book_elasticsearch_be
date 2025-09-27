import { Request, Response } from "express";
import { prisma } from "configs/client";

// ====== Cấu hình ======

const FALLBACK_DETAIL =
  "Within every book, a unique journey awaits. It's shaped by a captivating title and penned by an author with the ability to breathe life into words. From the very first pages, readers are led into a world that might be a thrilling adventure, a mystery waiting to be solved, or a deep reflection on life. A book is more than just a story; it's a mirror reflecting human questions and complex emotions. Every element, from the plot to the characters, is crafted to spark curiosity and invite you to explore. It's an invitation to step beyond the boundaries of reality, to get lost in another world, and to find the hidden meaning behind every word for yourself.";

// ====== Helpers ======
function randInt(min: number, max: number) {
  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shortOneFifth(s: string, minChars = 80, maxChars = 255) {
  const text = (s || "").trim();
  if (!text) return "N/A";
  const target = Math.ceil(text.length / 5);
  const n = Math.max(minChars, Math.min(target, maxChars));
  let out = text.slice(0, n);
  const cut = out.lastIndexOf(" ");
  if (cut > Math.floor(n * 0.6)) out = out.slice(0, cut);
  if (out.length < text.length) out = out.trimEnd() + "…";
  return out;
}

function isNA(x?: string | null) {
  if (!x) return true;
  return /N\/A/i.test(x.trim());
}

export const fixAllPlaceholderBooks = async (req: Request, res: Response) => {
  try {
    // Lấy danh sách ứng viên (chọn cần thiết để tính toán)
    const candidates = await prisma.book.findMany({
      where: {
        OR: [
          { price: 0 },
          { detailDesc: { contains: "N/A" } },
          { shortDesc: { contains: "N/A" } },
        ],
      },
      select: { id: true, price: true, detailDesc: true, shortDesc: true },
    });

    if (!candidates.length) {
      return res.status(200).json({
        data: { updated: 0, failed: 0 },
        note: "Không có sách cần sửa.",
      });
    }

    const tasks = candidates.map((b) => {
      const needPrice = b.price === 0;
      const needDetail = isNA(b.detailDesc);
      const needShort = isNA(b.shortDesc);

      // Nếu detail sẽ được thay, short dùng theo detail mới
      const nextDetail = needDetail
        ? FALLBACK_DETAIL
        : b.detailDesc || FALLBACK_DETAIL;
      const nextShort = needShort ? shortOneFifth(nextDetail) : b.shortDesc;
      const PRICE_MIN = 100_000;
      const PRICE_MAX = 1_500_000;
      const data: any = {};
      if (needPrice) data.price = randInt(PRICE_MIN, PRICE_MAX);
      if (needDetail) data.detailDesc = nextDetail;
      if (needShort) data.shortDesc = nextShort;

      // Không có gì để sửa thì bỏ qua
      if (Object.keys(data).length === 0)
        return Promise.resolve({ ok: true, id: b.id });

      return prisma.book
        .update({ where: { id: b.id }, data })
        .then(() => ({ ok: true, id: b.id }))
        .catch((e) => ({
          ok: false,
          id: b.id,
          error: e?.message || String(e),
        }));
    });

    const results = await Promise.all(tasks);
    const updated = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return res.status(200).json({
      data: { updated, failed: failed.length },
      failed, // liệt kê id nào lỗi để bạn tiện tra
    });
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || String(err), data: null });
  }
};
