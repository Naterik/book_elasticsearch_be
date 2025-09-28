import { client } from "configs/elastic";
import { Request, Response } from "express";
const index = process.env.INDEX_N_GRAM!;
const filterElastic = async (req: Request, res: Response) => {
  try {
    const {
      publisherId,
      search,
      minPrice,
      maxPrice,
      genres,
      year,
      language,
      page,
      order,
    } = req.query;
    let must = [];
    let filter = [];
    let sort = [];
    let terms_set = {};
    if (search) {
      must = [
        {
          multi_match: {
            query: search as string | null,
            type: "best_fields",
            fields: ["authors.name.keyword", "title^2", "detailDesc"],
          },
        },
      ];
    }

    if (minPrice) {
      filter = [
        {
          range: {
            price: {
              gte: minPrice,
            },
          },
        },
      ];
    }
    if (maxPrice) {
      filter = [
        {
          range: {
            price: {
              lte: maxPrice,
            },
          },
        },
      ];
    }

    if (minPrice && maxPrice) {
      filter = [
        {
          range: {
            price: {
              gte: minPrice,
              lte: maxPrice,
            },
          },
        },
      ];
    }
    if (year) {
      filter = [
        ...filter,
        {
          range: {
            publishDate: {
              gte: `${year}-01-01`,
              lte: `${year}-12-31`,
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
      const genreIds: any = (genres as string).split(",");
      filter = [
        ...filter,
        {
          terms_set: {
            "genres.genres.id": {
              terms: genreIds.map((h) => +h),
              minimum_should_match_script: { source: `${genreIds.length}` },
            },
          },
        },
      ];
    }

    if (order) {
      sort = [{ publishDate: { order: "desc" } }];
    }

    const query = {
      bool: {
        must,
        ...(filter.length > 0 ? { filter: filter } : {}),
      },
    };
    const pageSize = +process.env.ITEM_PER_PAGE;
    let currentPage = +page ? +page : 1;
    const skip = (currentPage - 1) * pageSize;
    const result: any = await client.search({
      index,
      size: pageSize,
      from: skip,
      query,
      sort,
      track_total_hits: true,
      filter_path: ["hits.hits._source", "hits.hits._score", "hits.total"],
    });
    const total: number = result.hits.total.value;
    if (total === 0) {
      throw new Error("No search results found !");
    }

    const totalPage = Math.ceil(total / pageSize);
    const data = result.hits.hits.map((data) => {
      return {
        score: data._score,
        ...data._source,
      };
    });
    res.status(200).json({
      data,
      pagination: {
        currentPage,
        totalPage,
        pageSize,
        totalItems: total,
      },
    });
  } catch (e) {
    res.status(400).json({
      message: e.message,
      data: [],
    });
  }
};

export { filterElastic };
