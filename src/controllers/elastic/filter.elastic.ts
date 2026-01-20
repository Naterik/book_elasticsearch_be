import { client } from "configs/elastic";
import { Request, Response } from "express";
import { sendResponse } from "src/utils";

type IFilterBookInput = {
  publisherId?: string;
  search?: string;
  priceRange?: number[];
  genres?: string | string[];
  yearRange?: number[];
  language?: string;
  page?: number;
  order?: string;
};
const index = process.env.INDEX_N_GRAM_BOOK!;
const filterElastic = async (req: Request, res: Response) => {
  try {
    const {
      publisherId,
      search,
      priceRange,
      genres,
      yearRange,
      language,
      page,
      order,
    } = req.query as IFilterBookInput;
    let must: any[] = [];
    let filter: any[] = [];
    let sort = [];

    // --- 1. SEARCH LOGIC (Absolute ID or Smart Text) ---
    if (search && (search as string).trim().length > 0) {
      // CASE 2: Smart Keyword Search (Typo Tolerance + Suggestions)
      const rawQ = (search as string) || "";
      const q = rawQ.replace(/\s+/g, " ").trim();
      const isPhraseMode = rawQ.endsWith(" ");
      const operator = isPhraseMode ? "and" : "or";

      must.push({
        bool: {
          should: [
            // A. Prefix Match (Highest Priority) - "Search-as-you-type" Logic
            {
              multi_match: {
                query: q,
                fields: [
                  "title.prefix^15",   // Exact prefix is absolute king
                  "title.keyword^20",  // Exact title match is God
                  "title^10",          // Standard title match
                  "authors.name^5",
                ],
                type: "bool_prefix",
                operator: "and" // FORCE AND: All terms must appear (e.g. "One Punch" -> must provide both)
              }
            },
            // B. Fuzzy Match (Typo Tolerance) - "Forgiveness"
            {
              multi_match: {
                query: q,
                fields: ["title.clean^3", "authors.name^2", "shortDesc"],
                fuzziness: "AUTO",
                prefix_length: 2,
                operator: "and" // FORCE AND: Even with typos, all words must be present
              }
            }
          ],
          minimum_should_match: 1
        }
      });
    } else {
        // CASE 3: No Search Term (Show All)
        must.push({ match_all: {} });
    }

    // --- 2. FILTER LOGIC (Existing Facets) ---
    if (priceRange) {
      filter.push({
        range: {
            price: {
            gte: +priceRange[0],
            lte: +priceRange[1],
            },
        },
      });
    }

    if (yearRange) {
      filter.push({
        range: {
            publishDate: {
            gte: `${+yearRange[0]}-01-01`,
            lte: `${+yearRange[1]}-12-31`,
            format: "yyyy-MM-dd",
            },
        },
      });
    }

    if (language) {
      filter.push({ term: { language } });
    }

    if (publisherId) {
      filter.push({ term: { publisherId } });
    }

    if (genres) {
      // Robust handling for String OR Array inputs
      // ?genres=A,B (String) OR ?genres=A&genres=B (Array)
      let genreNames: string[] = [];
      
      if (Array.isArray(genres)) {
          genreNames = genres.map(g => String(g));
      } else if (typeof genres === "string") {
          genreNames = genres.split(",");
      }

      if (genreNames.length > 0) {
          filter.push({
            terms: { "genres.genres.name.keyword": genreNames }
          });
      }
    }

    // --- 3. SORTING ---
    if (order) {
      if (order === "newest") {
        sort = [{ publishDate: { order: "desc" } }];
      }
      if (order === "oldest") {
        sort = [{ publishDate: { order: "asc" } }];
      }
      if (order === "title") {
        sort = [{ "title.keyword": { order: "asc" } }];
      }
      if (order === "price_asc") {
        sort = [{ price: { order: "asc" } }];
      }
      if (order === "price_desc") {
        sort = [{ price: { order: "desc" } }];
      }
    }

    // --- 4. EXECUTION ---
    const pageSize = Number(req.query.limit) || Number(process.env.ITEM_PER_PAGE) || 10;
    let currentPage = +page ? +page : 1;
    const skip = (currentPage - 1) * pageSize;

    const query = {
      bool: {
        must: must,
        filter: filter,
      },
    };

    const results: any = await client.search({
      index,
      size: pageSize,
      from: skip,
      query,
      sort,
      track_total_hits: true,
      highlight: {
        pre_tags: ["<em>"],
        post_tags: ["</em>"],
        fields: {
          "title": {},
          "shortDesc": {},
          "authors.name": {}
        }
      },
      filter_path: ["hits.hits._source", "hits.hits._score", "hits.hits.highlight", "hits.total"],
    });

    // Handle Empty Results
    if (!results.hits || !results.hits.total || results.hits.total.value === 0) {
      return sendResponse(res, 200, "success", {
        result: [],
        pagination: {
          currentPage,
          totalPages: 0,
          pageSize,
          totalItems: 0,
        },
      });
    }

    const total: number = results.hits.total.value;
    const totalPages = Math.ceil(total / pageSize);

    let result = results.hits.hits.map((data: any) => {
      return {
        score: data._score,
        ...data._source,
        highlight: data.highlight // Include highlight in filter results too!
      };
    });

    return sendResponse(res, 200, "success", {
      result,
      pagination: {
        currentPage,
        totalPages,
        pageSize,
        totalItems: total,
      },
    });
  } catch (e: any) {
    console.error("Filter Search Error:", e);
    return sendResponse(res, 400, "error", e.message);
  }
};

type IFilterBookcopyInput = {
  page?: number;
  search?: string;
  yearPublished?: number;
  status?: string;
};
const filterElasticBookCopy = async (req: Request, res: Response) => {
  try {
    const index_c = process.env.INDEX_BOOKCOPY!;
    const { page, search, yearPublished, status } = req.query as IFilterBookcopyInput;
    const pageSize = Number(process.env.ITEM_PER_PAGE) || 10;
    
    let currentPage = +page ? +page : 1;
    const skip = (currentPage - 1) * pageSize;

    // --- SMART INVENTORY SEARCH ---
    let must: any[] = [];
    let filter: any[] = [];

    if (search && search.trim().length > 0) {
      const q = search.trim();
      const isPhraseMode = q.endsWith(" ");
      const operator = isPhraseMode ? "and" : "or";

      must.push({
        bool: {
           should: [
             // 1. BARCODE / COPY NUMBER (Absolute Priority for Inventory)
             // Case A: Exact Match (High Boost)
             { term: { "copyNumber.keyword": { value: q, boost: 100 } } },
             // Case B: Prefix Match (e.g. "ABC12" finds "ABC1234") - Crucial for bar scanner
             { prefix: { "copyNumber.keyword": { value: q, boost: 50 } } },
             // Case C: N-gram Match (e.g. "123" finds "ABC12345")
             { match: { "copyNumber": { query: q, boost: 20 } } },

             // 2. BOOK TITLE (Contextual Logic)
             // If not a barcode, maybe they are searching by Title?
             {
                multi_match: {
                    query: q,
                    fields: ["books.title.prefix^10", "books.title^5"],
                    type: "bool_prefix",
                    operator: operator // Respect user's typing flow
                }
             },
             

           ],
           minimum_should_match: 1
        }
      });
    } else {
        must.push({ match_all: {} });
    }

    // --- FILTERS ---
    if (yearPublished) {
      filter.push({ term: { year_published: yearPublished } });
    }

    if (status) {
      filter.push({ term: { status: status } });
    }

    const query = {
      bool: {
        must: must,
        filter: filter,
      },
    };

    const results: any = await client.search({
      index: index_c,
      size: pageSize,
      from: skip,
      query,
      track_total_hits: true,
      filter_path: ["hits.hits._source", "hits.hits._score", "hits.total"],
    });

    const total: number = results.hits.total.value;

    if (total === 0 || results.hits.hits.length === 0) {
      return sendResponse(res, 200, "success", {
        result: [],
        pagination: {
          currentPage,
          totalPages: 0,
          pageSize,
          totalItems: 0,
        },
      });
    }

    const totalPages = Math.ceil(total / pageSize);
    const result = results.hits.hits.map((data: any) => {
      return {
        score: data._score,
        ...data._source,
      };
    });

    return sendResponse(res, 200, "success", {
      result,
      pagination: {
        currentPage,
        totalPages,
        pageSize,
        totalItems: total,
      },
    });
  } catch (e: any) {
    console.error("BookCopy Filter Error:", e);
    return sendResponse(res, 400, "error", e.message);
  }
};

export { filterElastic, filterElasticBookCopy };



