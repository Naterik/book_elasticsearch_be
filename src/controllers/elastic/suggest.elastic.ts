import { client } from "configs/elastic";
import { Request, Response } from "express";
const index = process.env.INDEX_N_GRAM_BOOK;

const suggestElastic = async (req: Request, res: Response) => {
  try {
    const { q, size = 5 } = req.query;
    const prefix = String(q || "").trim();
    const limit = Math.min(Number(size) || 5, 10);

    if (!prefix) return res.status(200).json({ data: [] });

    // Strategy: Ưu tiên exact match và prefix match cao nhất
    const results: any = await client.search({
      index,
      size: limit,
      query: {
        bool: {
          should: [
            // 1. HIGHEST: Exact title match
            {
              term: {
                "title.keyword": {
                  value: prefix,
                  boost: 1000,
                },
              },
            },
            // 2. Very High: Exact phrase match
            {
              match_phrase: {
                title: {
                  query: prefix,
                  boost: 500,
                },
              },
            },
            // 3. High: Title starts with prefix
            {
              match_phrase_prefix: {
                title: {
                  query: prefix,
                  boost: 100,
                },
              },
            },
            // 4. Medium: Prefix query
            {
              prefix: {
                "title.prefix": {
                  value: prefix.toLowerCase(),
                  boost: 50,
                },
              },
            },
            // 5. Lower: Author name starts with prefix
            {
              match_phrase_prefix: {
                "authors.name": {
                  query: prefix,
                  boost: 20,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      _source: ["title", "authors.name", "id"],
      collapse: {
        field: "title.keyword",
      },
    });

    const suggestions = (results.hits?.hits || []).map((hit: any) => ({
      text: hit._source.title,
      score: hit._score,
      author: hit._source.authors?.name || "",
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
export { suggestElastic };
