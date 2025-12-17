import { client } from "configs/elastic";
import { count } from "console";
import { Request, Response } from "express";
const index = process.env.INDEX_N_GRAM_BOOK;
const countLanguage = async (request: Request, res: Response) => {
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
  res.status(200).json({
    data: data.aggregations.count_languages.buckets,
  });
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
    res.status(200).json({
      data: data.aggregations.count_genres.buckets,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
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
    res.status(200).json({
      data: data.aggregations.count_year_published.buckets,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
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
    res.status(200).json({
      data: data.aggregations.count_status.buckets,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
};

export {
  countLanguage,
  countGenres,
  countYearPublishedFromBookCopy,
  countStatusFromBookCopy,
};
