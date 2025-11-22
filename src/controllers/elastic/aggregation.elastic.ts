import { client } from "configs/elastic";
import { Request, Response } from "express";
const index = process.env.INDEX_N_GRAM_BOOK;
const countLanguage = async (request: Request, res: Response) => {
  const data: any = await client.search({
    index,
    size: 0,
    aggs: {
      count_languages: {
        terms: {
          field: "language",
          size: 100,
        },
      },
    },
    filter_path: ["aggregations.count_languages.buckets"],
  });
  res.status(200).json({
    data: data.aggregations.count_languages.buckets,
  });
};

const countGenres = async (request: Request, res: Response) => {
  try {
    const data: any = await client.search({
      index,
      size: 0,
      aggs: {
        count_genres: {
          terms: {
            field: "genres.genres.name.keyword",
          },
        },
      },
    });
    res.status(200).json({
      data: data.aggregations.count_genres.buckets,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const suggestElastic = async (req: Request, res: Response) => {
  try {
    const { q, size = 5 } = req.query;
    const prefix = String(q || "").trim();
    const limit = Math.min(Number(size) || 5, 10);

    if (!prefix) return res.status(200).json({ data: [] });

    const results: any = await client.search({
      index,
      size: 0,
      suggest: {
        // Tên key này có thể đặt tùy ý, ví dụ "global_suggestion"
        global_suggestion: {
          prefix,
          completion: {
            field: "suggest", // Tên field chung chúng ta đã tạo ở Bước 1
            size: limit,
            skip_duplicates: true,
            fuzzy: { fuzziness: "AUTO" },
          },
        },
      },
    });

    const suggestions = (
      results.suggest?.global_suggestion?.[0]?.options || []
    ).map((o: any) => ({
      text: o.text,
    }));

    if (suggestions.length === 0) {
      return res
        .status(400)
        .json({ data: null, message: "Not found any result" });
    }

    return res.status(200).json({ data: suggestions });
  } catch (e: any) {
    return res.status(400).json({ message: e.message, data: null });
  }
};

export { countLanguage, suggestElastic, countGenres };
