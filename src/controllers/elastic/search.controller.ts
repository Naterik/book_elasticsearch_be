import { Request, Response } from "express";
import { client } from "configs/elastic";
import { sendResponse } from "src/utils";

/**
 * Thin Proxy for Instant Search (Meilisearch-like experience)
 * Bypasses Database, connects directly to Elasticsearch
 */
/**
 * Thin Proxy for Instant Search (Hybrid: Search + Suggest + Filter)
 * Bypasses Database, connects directly to Elasticsearch
 */
export const searchBooksInstant = async (req: Request, res: Response) => {
  try {
    // 1. Sanitize Input (Pre-processing)
    const rawQ = (req.query.q as string) || "";
    const exactId = req.query.exactId as string; // Explicitly catch strict ID
    const q = rawQ.replace(/\s+/g, " ").trim(); 
    
    // Detect "Typing Mode" vs "Phrase Mode"
    const isPhraseMode = rawQ.endsWith(" "); 
    const operator = isPhraseMode ? "and" : "or";

    // Pagination & Filters
    const limit = Number(req.query.limit) || 10;
    const { authors, genres } = req.query; // Expect comma-separated IDs or values

    const bookIndex = process.env.INDEX_N_GRAM_BOOK || "books_index";

    // Base Bool Query
    const mustQuery: any[] = [];
    const filterQuery: any[] = [];

    // --- A. Build Search Query (Description-Aware Logic) ---
    if (exactId) {
      // 1. "Absolute Selection" Mode - Navigation behavior (Google Style: Click Suggestion -> Go to Item)
      // Ignores fuzzy matching and description search entirely.
       mustQuery.push({
         term: { id: exactId }
       });
    } else if (q) {
      // 2. "Discovery" Mode - Broad Search (Title + Description + Author)
      mustQuery.push({
        bool: {
          should: [
            // 1. Prefix Match (Highest Priority) - "Search-as-you-type"
            {
              multi_match: {
                query: q,
                fields: [
                  "title.prefix^15",   // Exact prefix is absolute king
                  "title.keyword^20",  // Perfect match is god
                  "title^10",          // Standard title match
                  "authors.name^5",
                  "isbn^10"
                ],
                type: "bool_prefix",
                operator: "and" 
              }
            },
            // 2. Fuzzy Match (Typo & Description Tolerance) - "Forgiveness & Context"
            {
              multi_match: {
                query: q,
                fields: [
                  "title.clean^3", 
                  "authors.name^2", 
                  "shortDesc^2", // Boosted Description for "finding by context"
                  "detailDesc^1"  // Deep Search
                ],
                fuzziness: "AUTO",
                prefix_length: 2,
                operator: "and"
              }
            }
          ],
          minimum_should_match: 1 
        }
      });
    }

    // --- B. Apply Filters ---
    if (authors) {
      const authorList = (authors as string).split(",");
      filterQuery.push({
        terms: { "authors.name.keyword": authorList } 
      });
    }

    if (genres) {
      const genreList = (genres as string).split(",");
      filterQuery.push({
        terms: { "genres.genres.name.keyword": genreList }
      });
    }

    // --- C. Execute Query with Collapse (Title Suggestion Focus) ---
    // We remove generic aggregations and focus on "Best Title Matches"
    // Using simple search results as suggestions is often the best "Smart Search" behavior
    const result = await client.search({
      index: bookIndex,
      size: limit,
      body: {
        query: {
          bool: {
            must: mustQuery,
            filter: filterQuery
          }
        },
        highlight: {
          pre_tags: ["<em>"],
          post_tags: ["</em>"],
          fields: {
            "title": {},
            "shortDesc": {},
            "detailDesc": {}, // Added highlight for detail
            "authors.name": {}
          }
        },
        // We use aggregation to find "Top Recursive Titles" if we wanted distinct titles,
        // but for now, the hits themselves ARE the suggestions.
        _source: ["id", "title", "image", "authors", "genres", "slug", "price", "shortDesc", "quantity", "borrowed"]
      }
    });

    // --- D. Transform Response (Unified Format) ---
    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source as any,
      highlight: hit.highlight
    }));

    // Extract "Title Suggestions" from the Hits themselves
    // Deduping titles in case of slight variants (though less likely with ID based index)
    const titleSuggestions = Array.from(new Set(hits.map((h: any) => h.title))).slice(0, 5);

    const suggestions = {
        titles: titleSuggestions,
        // We removed authors/genres suggestions as requested to focus on Content
    };

    return sendResponse(res, 200, "success", {
      books: hits,
      suggestions: suggestions,
      total: result.hits.total
    });

  } catch (error: any) {
    console.error("Instant Search Error:", error);
    return sendResponse(res, 500, "error", error.message);
  }
};
