import { client } from "configs/elastic";
import { count } from "console";
import { Request, Response } from "express";
import { sendResponse } from "src/utils";

const index = process.env.INDEX_N_GRAM_BOOK;

const countLanguage = async (request: Request, res: Response) => {
  try {
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
    return sendResponse(
      res,
      200,
      "success",
      data.aggregations.count_languages.buckets
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
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
    return sendResponse(
      res,
      200,
      "success",
      data.aggregations.count_genres.buckets
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

const index_copy = process.env.INDEX_BOOKCOPY;
const countYearPublishedFromBookCopy = async (req: Request, res: Response) => {
  try {
    const data: any = await client.search({
      index: index_copy,
      size: 0,
      aggs: {
        count_year_published: {
          terms: {
            field: "year_published",
            size: 130,
          },
        },
      },
    });
    return sendResponse(
      res,
      200,
      "success",
      data.aggregations.count_year_published.buckets
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};
const countStatusFromBookCopy = async (req: Request, res: Response) => {
  try {
    const data: any = await client.search({
      index: index_copy,
      size: 0,
      aggs: {
        count_status: {
          terms: {
            field: "status",
            size: 5,
          },
        },
      },
    });
    return sendResponse(
      res,
      200,
      "success",
      data.aggregations.count_status.buckets
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

export {
  countLanguage,
  countGenres,
  countYearPublishedFromBookCopy,
  countStatusFromBookCopy,
};

