
import { Request, Response } from "express";
import { client } from "configs/elastic";
import { sendResponse } from "src/utils";

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
    // const bookCopyIndex = process.env.INDEX_BOOKCOPY || "book_copies"; // Cleaned up for Client Separation

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
          require_field_match: false,
          fields: {
            "title": {
              highlight_query: {
                bool: {
                  should: [
                    { match: { "title": { query: q, operator: "and" } } },
                  ]
                }
              }
            },
            "shortDesc": {},
            "detailDesc": {},
            "authors.name": {
              highlight_query: {
                bool: {
                  should: [
                    { match: { "authors.name": { query: q, operator: "and" } } }
                  ]
                }
              }
            }
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

/**
 * Admin Inventory Search
 * Focus: Precision, Barcode Parsing, Inventory Management
 */
export const searchBooksAdmin = async (req: Request, res: Response) => {
  try {
    const rawQ = (req.query.q as string) || "";
    const q = rawQ.replace(/\s+/g, " ").trim();
    const limit = Number(req.query.limit) || 20; 
    const page = Number(req.query.page) || 1;
    const from = (page - 1) * limit;
    
    const bookIndex = process.env.INDEX_N_GRAM_BOOK || "books_index";
    const bookCopyIndex = process.env.INDEX_BOOKCOPY || "book_copies";

    // --- 1. Priority Rule: Check Barcode / Copy ID first ---
    // Admin often scans a barcode with a handheld scanner
    if (q && (q.toUpperCase().startsWith("CP-") || /^\d+$/.test(q))) {
       const copyResult = await client.search({
         index: bookCopyIndex,
         body: {
           query: {
             term: { "copyNumber.keyword": q } 
           }
         }
       });

       // Logic: If Admin scans a barcode, they want THAT specific item, nothing else.
       if (copyResult.hits.total && (typeof copyResult.hits.total === 'number' ? copyResult.hits.total : copyResult.hits.total.value) > 0) {
          const copyHit = copyResult.hits.hits[0]._source as any;
          return sendResponse(res, 200, "success", {
            result: [{
              id: copyHit.books.id,
              ...copyHit.books,
              matchedCopyId: copyHit.id,
              isDirectBarcodeMatch: true // Signal for UI
            }],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                pageSize: limit,
                totalItems: 1
            }
          });
       }
    }

    // --- 2. Fallback: Standard Administrative Search ---
    // User is searching by Title/Author to manage the catalog
    const mustQuery: any[] = [];

    if (q) {
      mustQuery.push({
        multi_match: {
          query: q,
          fields: [
            "title.keyword^10", // Admin needs exact title lookup often
            "title^5",
            "authors.name^3", 
            "isbn^10"
          ],
          operator: "and" // Admin usually knows what they are typing, "OR" creates noise
        }
      });
    }

    const result = await client.search({
      index: bookIndex,
      size: limit,
      from: from,
      body: {
        query: {
          bool: {
            must: mustQuery,
            filter: [
               // 1. Stock Status Filter
               ...(req.query.stock
                 ? [
                     req.query.stock === "out_of_stock"
                       ? { term: { quantity: 0 } }
                       : { range: { quantity: { gt: 0 } } },
                   ]
                 : []),

               // 2. Language Filter
               ...(req.query.language
                 ? [{ term: { language: req.query.language } }]
                 : []),

               // 3. Genre Filter (Nested/Object Array)
               ...(req.query.genreIds
                 ? [
                     {
                       terms: {
                         "genres.genres.id": (req.query.genreIds as string)
                           .split(",")
                           .map(Number),
                       },
                     },
                   ]
                 : []),

               // 4. Author Filter (Root ID)
                ...(req.query.authorIds
                  ? [
                      {
                        terms: {
                          authorId: (req.query.authorIds as string)
                            .split(",")
                            .map(Number),
                        },
                      },
                    ]
                  : []),
            ]          }
        },
        _source: ["id", "title", "image", "authors", "genres", "isbn", "quantity", "borrowed", "publishers", "digitalBook"]
      }
    });

    const hits = result.hits.hits.map((hit: any) => {
      const source = hit._source;
      return {
        id: hit._id,
        ...source,
        // Ensure publishers matches Prisma's return style: { name: string }
        publishers: source.publishers ? { name: source.publishers.name } : null,
        // Ensure digitalBook matches Prisma's return style: { status: string }
        digitalBook: source.digitalBook ? { status: source.digitalBook.status } : null,
        // Ensure genres matches Prisma's return style: [{ genres: { id, name } }]
        // Elastic already stores it as nested object array, but we ensure structure.
        genres: source.genres?.map((g: any) => ({
             genres: {
                 id: g.genres?.id || g.id,
                 name: g.genres?.name || g.name
             }
        })) || []
      };
    });

    const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;
    const totalPages = Math.ceil(total / limit);

    return sendResponse(res, 200, "success", {
        result: hits,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: limit,
          totalItems: total,
        },
    });


  } catch (error: any) {
    console.error("Admin Search Error:", error);
    return sendResponse(res, 500, "error", error.message);
  }
};
