import { client } from "configs/elastic";
import { Request, Response } from "express";
import { allBook, handleGetAllBooks } from "services/book/book.services";

const index = process.env.INDEX_N_GRAM!;
const createIndex = async (req: Request, res: Response) => {
  console.log("client :>> ", await client.info());
  const getbooks = await allBook();
  const operations = getbooks.flatMap((doc) => [
    { index: { _index: index } },
    doc,
  ]);
  const bulkResponse = await client.bulk({ refresh: true, operations });
  res.json({ bulkResponse });
};

const createIndexWithToken = async (req: Request, res: Response) => {
  const tokenizer = process.env.TOKEN_N_GRAM!;
  const exists = await client.indices.exists({ index });
  if (exists) await client.indices.delete({ index });
  const ngramIndex = await client.indices.create({
    index,
    settings: {
      analysis: {
        analyzer: {
          autocomplete_index: {
            type: "custom",
            tokenizer,
            filter: ["lowercase"],
          },
          autocomplete_search: {
            type: "custom",
            tokenizer: "standard",
            filter: ["lowercase"],
          },
        },
        tokenizer: {
          tokenizer: {
            type: "edge_ngram",
            min_gram: 2,
            max_gram: 20,
            token_chars: ["letter", "digit"],
          },
        },
      },
    },
    mappings: {
      properties: {
        authorId: { type: "long" },
        authors: {
          properties: {
            name: {
              type: "text",
              analyzer: "autocomplete_index",
              search_analyzer: "autocomplete_search",
              fields: {
                keyword: { type: "keyword", ignore_above: 256 },
              },
            },
          },
        },
        borrowed: { type: "long" },
        detailDesc: { type: "text" },

        genres: {
          properties: {
            genres: {
              properties: {
                id: { type: "long" },
                name: {
                  type: "text",
                  analyzer: "autocomplete_index",
                  search_analyzer: "autocomplete_search",
                  fields: {
                    keyword: { type: "keyword", ignore_above: 256 },
                  },
                },
              },
            },
          },
        },

        id: { type: "long" },
        image: { type: "text" },

        isbn: {
          type: "text",
          fields: {
            keyword: { type: "keyword", ignore_above: 256 },
          },
        },

        language: { type: "keyword", ignore_above: 256 },
        pages: { type: "long" },
        price: { type: "long" },

        publishDate: { type: "date" },

        publisherId: { type: "long" },
        publishers: {
          properties: {
            name: {
              type: "text",
              analyzer: "autocomplete_index",
              search_analyzer: "autocomplete_search",
              fields: {
                keyword: { type: "keyword", ignore_above: 256 },
              },
            },
          },
        },

        quantity: { type: "long" },
        shortDesc: { type: "text" },

        title: {
          type: "text",
          analyzer: "autocomplete_index",
          search_analyzer: "autocomplete_search",
          fields: {
            keyword: { type: "keyword", ignore_above: 256 },
          },
        },
      },
    },
  });

  await client.indices.refresh({ index });
  res.status(200).json({
    data: ngramIndex,
  });
};

export { createIndex, createIndexWithToken };
