import { client } from "configs/elastic";
import { Request, Response } from "express";

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
    } = req.query;
    let must = [];
    let filter = [];
    let sort = [];

    if (search && (search as string).trim().length > 0) {
      must = [
        {
          multi_match: {
            query: search as string | null,
            type: "best_fields",
            fields: ["authors.name.keyword", "title^2"],
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
      return res.status(200).json({
        data: {
          result: [],
          pagination: {
            currentPage,
            totalPages: 0,
            pageSize,
            totalItems: 0,
          },
          message: "No results found for the applied filters",
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

    res.status(200).json({
      data: {
        result,
        pagination: {
          currentPage,
          totalPages,
          pageSize,
          totalItems: total,
        },
      },
    });
  } catch (e) {
    res.status(400).json({
      message: e.message,
      data: null,
    });
  }
};

const findBookCopyLocation = async (req: Request, res: Response) => {
  try {
    const indexc = process.env.INDEX_C;
    const { page, search } = req.query;
    const pageSize = +process.env.ITEM_PER_PAGE;
    let currentPage = +page ? +page : 1;
    const skip = (currentPage - 1) * pageSize;

    // Build query: show all if no search, otherwise search by location
    let query: any = {};
    if (search && (search as string).trim().length > 0) {
      query = {
        multi_match: {
          query: search as string,
          fields: ["location", "books.title", "copyNumber"],
        },
      };
    } else {
      // Show all book copies if no search query provided
      query = {
        match_all: {},
      };
    }

    const results: any = await client.search({
      index: indexc,
      size: pageSize,
      from: skip,
      query,
      track_total_hits: true,
      filter_path: ["hits.hits._source", "hits.hits._score", "hits.total"],
    });

    const total: number = results.hits.total.value;

    // Return empty result set with pagination if no results, instead of throwing error
    if (total === 0) {
      return res.status(200).json({
        data: {
          result: [],
          pagination: {
            currentPage,
            totalPages: 0,
            pageSize,
            totalItems: 0,
          },
          message: "No book copies found",
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

    res.status(200).json({
      data: {
        result,
        pagination: {
          currentPage,
          totalPages,
          pageSize,
          totalItems: total,
        },
      },
    });
  } catch (e) {
    res.status(400).json({
      message: e.message,
      data: null,
    });
  }
};

export { filterElastic, findBookCopyLocation };
