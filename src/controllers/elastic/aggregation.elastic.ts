import { client } from "configs/elastic";
import { Request, Response } from "express";
const index = process.env.ELASTIC_INDEX_NAME;
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

export { countLanguage };
