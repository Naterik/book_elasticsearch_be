import { client } from "configs/elastic";
import { Request, Response } from "express";
import { sendResponse } from "src/utils";

type IFilterBookInput = {
  publisherId?: string;
  search?: string;
  priceRange?: number[];
  genres?: string;
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
    let must = [];
    let filter = [];
    let sort = [];

    if (search && (search as string).trim().length > 0) {
      const searchWords = (search as string).trim().split(/\s+/);
      const wordCount = searchWords.length;

      must = [
        {
          bool: {
            should: [
              // 1. HIGHEST priority: Exact match (toÃ n bá»™ title khá»›p chÃ­nh xÃ¡c)
              {
                term: {
                  "title.keyword": {
                    value: search as string,
                    boost: 1000,
                  },
                },
              },
              // 2. Very high priority: Exact phrase match (case-insensitive)
              {
                match_phrase: {
                  title: {
                    query: search as string,
                    boost: 500,
                  },
                },
              },
              // 3. High priority: All words must match (AND operator)
              {
                match: {
                  title: {
                    query: search as string,
                    operator: "and",
                    boost: 100,
                  },
                },
              },
              // 4. Medium priority: Title starts with search query
              {
                match_phrase_prefix: {
                  title: {
                    query: search as string,
                    boost: 50,
                  },
                },
              },
              // 5. Lower priority: Author exact phrase
              {
                match_phrase: {
                  "authors.name": {
                    query: search as string,
                    boost: 20,
                  },
                },
              },
              // 6. Lowest priority: Fuzzy match (chá»‰ khi cÃ³ > 5 tá»«)
              ...(wordCount > 5
                ? [
                    {
                      multi_match: {
                        query: search as string,
                        fields: ["title^2", "authors.name"],
                        fuzziness: "1",
                        boost: 1,
                      },
                    },
                  ]
                : []),
            ],
            // YÃªu cáº§u Ã­t nháº¥t 1 trong cÃ¡c Ä‘iá»u kiá»‡n trÃªn pháº£i match
            minimum_should_match: 1,
          },
        },
      ];
    }

    if (priceRange) {
      filter = [
        {
          range: {
            price: {
              gte: +priceRange[0],
              lte: +priceRange[1],
            },
          },
        },
      ];
    }
    if (yearRange) {
      filter = [
        ...filter,
        {
          range: {
            publishDate: {
              gte: `${+yearRange[0]}-01-01`,
              lte: `${+yearRange[1]}-12-31`,
              format: "yyyy-MM-dd",
            },
          },
        },
      ];
    }
    if (language) {
      filter = [
        ...filter,
        {
          term: { language },
        },
      ];
    }
    if (publisherId) {
      filter = [
        ...filter,
        {
          term: {
            publisherId: publisherId,
          },
        },
      ];
    }
    if (genres) {
      const genreNames: Array<string> = (genres as string).split(",");
      filter = [
        ...filter,
        {
          terms_set: {
            "genres.genres.name.keyword": {
              terms: genreNames,
              minimum_should_match_script: { source: `${genreNames.length}` },
            },
          },
        },
      ];
    }

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
    }

    const query = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        ...(filter.length > 0 ? { filter: filter } : {}),
      },
    };

    const pageSize = +process.env.ITEM_PER_PAGE;
    let currentPage = +page ? +page : 1;
    const skip = (currentPage - 1) * pageSize;

    const results: any = await client.search({
      index,
      size: pageSize,
      from: skip,
      query,
      sort,
      track_total_hits: true,
      filter_path: ["hits.hits._source", "hits.hits._score", "hits.total"],
    });

    const total: number = results.hits.total.value;

    if (total === 0) {
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
    const result = results.hits.hits.map((data) => {
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
    const index_c = process.env.INDEX_BOOKCOPY;
    const { page, search, yearPublished, status } =
      req.query as IFilterBookcopyInput;
    const pageSize = +process.env.ITEM_PER_PAGE;
    let currentPage = +page ? +page : 1;
    const skip = (currentPage - 1) * pageSize;

    // Build query: show all if no search, otherwise search by location
    let must = [];
    let filter = [];
    if (search && search.trim().length > 0) {
      must = [
        {
          multi_match: {
            query: search,
            fields: ["location", "books.title^2", "copyNumber"],
          },
        },
      ];
    }

    if (yearPublished) {
      filter = [
        {
          term: { year_published: yearPublished },
        },
      ];
    }

    if (status) {
      filter = [
        ...filter,
        {
          term: { status: status },
        },
      ];
    }

    const query = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        ...(filter.length > 0 ? { filter: filter } : {}),
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

    // Return empty result set with pagination if no results, instead of throwing error
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

    const result = results.hits.hits.map((data) => {
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
    return sendResponse(res, 400, "error", e.message);
  }
};

export { filterElastic, filterElasticBookCopy };

