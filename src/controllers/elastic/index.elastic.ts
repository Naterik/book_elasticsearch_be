import { match } from "assert";
import { client } from "configs/elastic";
import { Request, Response } from "express";
import { allBook, handleGetAllBooks } from "services/book.services";
const createIndex = async (req: Request, res: Response) => {
  console.log("client :>> ", await client.info());
  const getbooks = await allBook();
  const operations = getbooks.flatMap((doc) => [
    { index: { _index: "books_data" } },
    doc,
  ]);
  const bulkResponse = await client.bulk({ refresh: true, operations });
  console.log("object :>> ", bulkResponse);
};

const filterElastic = async (req: Request, res: Response) => {
  const { publisher, search, minPrice, maxPrice, year, language, page, order } =
    req.query;
  const index = process.env.ELASTIC_INDEX_NAME;
  const pageSize = +process.env.ITEM_PER_PAGE;
  let currentPage = +page ? +page : 1;
  const skip = (currentPage - 1) * pageSize;
  let must = [];
  let filter = [];
  let sort = [];
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
  if (publisher) {
    must = [
      ...must,
      {
        match: {
          "publishers.name": publisher,
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

  if (order) {
    sort = [{ publishDate: { order: "desc" } }];
  }

  const query = {
    bool: {
      must,
      ...(filter.length > 0 ? { filter: filter } : {}),
    },
  };

  const result: any = await client.search({
    index,
    size: pageSize,
    from: skip,
    query,
    sort,
    track_total_hits: true,
    filter_path: ["hits.hits._source", "hits.hits._score", "hits.total"],
  });
  const tacktotal = result.hits.total.value;

  console.log("object :>> ", tacktotal);
  res.status(200).json({
    data: result.hits,
  });
};

export { createIndex, filterElastic };
