import { client } from "configs/elastic";
import { Request, Response } from "express";
import { sendResponse } from "src/utils";

const index = process.env.INDEX_N_GRAM_BOOK;

const suggestElastic = async (req: Request, res: Response) => {
  try {
    const { q, size = 5 } = req.query;
    const prefix = String(q || "").trim();
    const limit = Math.min(Number(size) || 5, 10);

    if (!prefix) return sendResponse(res, 200, "success", []);

    // Strategy: Option 2 (Strict Phrase Prefix) - Cleaner & "Google-like"
    // Removes loose fuzzy matching that causes "dc" -> "Sandman" issues.
    const results: any = await client.search({
      index,
      size: limit,
      query: {
        bool: {
          should: [
            // 1. HIGHEST: Exact title match (Case Insensitive via Normalizer if set, or Keyword)
            {
              term: {
                "title.keyword": {
                  value: prefix,
                  boost: 1000,
                },
              },
            },
            // 2. High: Starts strictly with this Prefix (e.g. "Har" -> "Harry...")
            {
              prefix: {
                "title.keyword": {
                  value: prefix,
                  boost: 500
                }
              }
            },
            // 3. Medium: Phrase Prefix (Finds "Potter" in "Harry Potter", but respects word boundaries)
            {
              match_phrase_prefix: {
                title: {
                  query: prefix,
                  boost: 100,
                  slop: 5 // Allows few words between, but keeps order
                },
              },
            },
          ],
          minimum_should_match: 1, // Must match at least one of the above strictly
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
      id: hit._source.id, // Include ID for Absolute Search
    }));

    if (suggestions.length === 0) {
      return sendResponse(res, 404, "error", "Not found any result");
    }

    return sendResponse(
      res,
      200,
      "success",
      suggestions
    );
  } catch (e: any) {
    return sendResponse(res, 400, "error", e.message);
  }
};
export { suggestElastic };

