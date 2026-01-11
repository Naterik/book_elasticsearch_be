import { client } from "configs/elastic";
import { Request, Response } from "express";
import {
  countBookCopies,
  getBookCopiesBatch,
} from "services/book/book-copy.service";
import { countBooks, getBooksBatch } from "services/book/book.service";
import { sendResponse } from "src/utils";

const booksIndex = process.env.INDEX_N_GRAM_BOOK!;
const bookCopiesIndex = process.env.INDEX_BOOKCOPY!;

// Batch processing constants
const BATCH_SIZE = 500; // Giáº£m kÃ­ch thÆ°á»›c batch Ä‘á»ƒ trÃ¡nh quÃ¡ táº£i
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // ms

// Utility function: Sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function: Bulk index vá»›i retry logic
const bulkIndexWithRetry = async (
  operations: any[],
  indexName: string,
  retryCount = 0
): Promise<any> => {
  try {
    const response = await client.bulk({
      refresh: true,
      operations,
    });
    return response;
  } catch (error: any) {
    if (
      retryCount < MAX_RETRIES &&
      error.message?.includes("es_rejected_execution_exception")
    ) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(
        `Bulk indexing failed, retrying in ${delay}ms (attempt ${
          retryCount + 1
        }/${MAX_RETRIES})...`
      );
      await sleep(delay);
      return bulkIndexWithRetry(operations, indexName, retryCount + 1);
    }
    throw error;
  }
};

// Utility function: Process documents in batches
const processBatch = async (
  documents: any[],
  indexName: string,
  documentMapper: (doc: any) => any = (doc) => doc
): Promise<number> => {
  let totalIndexed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        documents.length / BATCH_SIZE
      )} (${batch.length} documents)`
    );

    const operations = batch.flatMap((doc) => [
      { index: { _index: indexName, _id: String(doc.id) } },
      documentMapper(doc),
    ]);

    try {
      const bulkResponse = await bulkIndexWithRetry(operations, indexName);

      if (bulkResponse.errors) {
        console.warn(
          `Some documents failed to index in batch, but continuing...`
        );
      }

      totalIndexed += batch.length;
      console.log(
        `Successfully indexed batch: ${totalIndexed}/${documents.length}`
      );

      // Add delay between batches Ä‘á»ƒ Elasticsearch ká»‹p xá»­ lÃ½
      if (i + BATCH_SIZE < documents.length) {
        await sleep(500);
      }
    } catch (error: any) {
      console.error(
        `Failed to index batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
        error.message
      );
      throw error;
    }
  }

  return totalIndexed;
};
const createBookCopiesIndex = async (req: Request, res: Response) => {
  try {
    console.log("Creating book_copies index with ngram tokenizer...");

    const exists = await client.indices.exists({ index: bookCopiesIndex });
    const totalBookCopies = await countBookCopies();
    console.log(`Total book copies in DB: ${totalBookCopies}`);

    if (exists) {
      console.log(
        `Index ${bookCopiesIndex} already exists, keeping existing data...`
      );

      let totalIndexed = 0;
      let skip = 0;
      while (true) {
        const bookCopies = await getBookCopiesBatch(skip, BATCH_SIZE);
        if (bookCopies.length === 0) break;

        await processBatch(bookCopies, bookCopiesIndex);
        totalIndexed += bookCopies.length;
        skip += BATCH_SIZE;
        console.log(`Progress: ${totalIndexed}/${totalBookCopies}`);
      }

      return sendResponse(
        res,
        200,
        "success",
        {
          index: bookCopiesIndex,
          documentsUpdated: totalIndexed,
          totalInDB: totalBookCopies,
        }
      );
    }

    // Create new index with ngram settings
    await client.indices.create({
      index: bookCopiesIndex,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        "index.max_ngram_diff": 50,
        analysis: {
          analyzer: {
            ngram_analyzer: {
              type: "custom",
              tokenizer: "ngram_tokenizer",
              filter: ["lowercase", "asciifolding", "stop"],
            },
            standard_analyzer: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding"],
            },
          },
          tokenizer: {
            ngram_tokenizer: {
              type: "ngram",
              min_gram: 2,
              max_gram: 20,
              token_chars: ["letter", "digit", "punctuation", "symbol"],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: "long" },
          bookId: { type: "long" },
          barcode: { type: "keyword" },
          copyNumber: {
            type: "text",
            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
            },
            analyzer: "ngram_analyzer",
            search_analyzer: "standard_analyzer",
          },
          status: { type: "keyword" },
          shelf: { type: "keyword" },
          location: {
            type: "text",
            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
            },
            analyzer: "ngram_analyzer",
            search_analyzer: "standard_analyzer",
          },
          branch: { type: "keyword" },
          isbn: { type: "keyword" },
          acquiredAt: { type: "date" },
          year_published: { type: "long" },
          books: {
            properties: {
              id: { type: "long" },
              title: {
                type: "text",
                fields: {
                  keyword: { type: "keyword", ignore_above: 256 },
                },
                analyzer: "ngram_analyzer",
                search_analyzer: "standard_analyzer",
              },
              isbn: {
                type: "text",
                fields: {
                  keyword: { type: "keyword", ignore_above: 256 },
                },
              },
              shortDesc: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              detailDesc: {
                type: "text",
                fields: {
                  keyword: {
                    type: "keyword",
                    ignore_above: 256,
                  },
                },
              },
              price: { type: "long" },
              quantity: { type: "long" },
              borrowed: { type: "long" },
              pages: { type: "long" },
              publishDate: { type: "date" },
              language: {
                type: "text",
                fields: {
                  keyword: { type: "keyword", ignore_above: 256 },
                },
              },
              image: {
                type: "text",
                fields: {
                  keyword: { type: "keyword", ignore_above: 256 },
                },
              },
              authorId: { type: "long" },
              publisherId: { type: "long" },
            },
          },
          author: {
            type: "text",
            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
            },
            analyzer: "ngram_analyzer",
            search_analyzer: "standard_analyzer",
          },
        },
      },
    });

    console.log("Book copies index created successfully");

    // Fetch and index all book copies
    let totalIndexed = 0;
    let skip = 0;
    while (true) {
      const bookCopies = await getBookCopiesBatch(skip, BATCH_SIZE);
      if (bookCopies.length === 0) break;

      await processBatch(bookCopies, bookCopiesIndex);
      totalIndexed += bookCopies.length;
      skip += BATCH_SIZE;
      console.log(`Progress: ${totalIndexed}/${totalBookCopies}`);
    }

    return sendResponse(
      res,
      200,
      "success",
      {
        index: bookCopiesIndex,
        documentsIndexed: totalIndexed,
        totalInDB: totalBookCopies,
      }
    );
  } catch (error: any) {
    console.error("Error creating book copies index:", error);
    return sendResponse(
      res,
      500,
      "error",
      error.message
    );
  }
};

const createBooksIndex = async (req: Request, res: Response) => {
  try {
    const booksIndex = process.env.INDEX_N_GRAM_BOOK || "books_index";
    const exists = await client.indices.exists({ index: booksIndex });
    if (exists) {
      await client.indices.delete({ index: booksIndex });
      console.log(
        `Deleted existing index: ${booksIndex} to apply new settings.`
      );
    }

    await client.indices.create({
      index: booksIndex,

      settings: {
        number_of_shards: 1,

        number_of_replicas: 0,

        "index.max_ngram_diff": 50,

        analysis: {
          analyzer: {
            autocomplete_index: {
              type: "custom",

              tokenizer: "edge_ngram_tokenizer",

              filter: ["lowercase", "asciifolding", "stop"],
            },

            autocomplete_search: {
              type: "custom",

              tokenizer: "standard",

              filter: ["lowercase", "asciifolding"],
            },

            // Analyzer má»›i cho exact prefix match
            prefix_analyzer: {
              type: "custom",
              tokenizer: "keyword",
              filter: ["lowercase", "asciifolding"],
            },
          },

          tokenizer: {
            edge_ngram_tokenizer: {
              type: "edge_ngram",

              min_gram: 2,

              max_gram: 20,

              token_chars: ["letter", "digit", "punctuation"],
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

          detailDesc: {
            type: "text",

            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
            },
          },

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

            analyzer: "autocomplete_index",

            search_analyzer: "autocomplete_search",

            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
            },
          },

          language: {
            type: "keyword",

            ignore_above: 256,
          },

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

          shortDesc: {
            type: "text",

            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
            },
          },

          title: {
            type: "text",

            analyzer: "autocomplete_index",

            search_analyzer: "autocomplete_search",

            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
              prefix: {
                type: "text",
                analyzer: "prefix_analyzer",
                search_analyzer: "prefix_analyzer",
              },
            },
          },

          suggest: {
            type: "completion",

            preserve_separators: true,
          },
        },
      },
    });

    console.log("Books index structure created successfully");
    const totalBooks = await countBooks();
    let totalIndexed = 0;
    let skip = 0;
    while (true) {
      const books = await getBooksBatch(skip, BATCH_SIZE);
      if (books.length === 0) break;

      await processBatch(books, booksIndex, (doc) => {
        const suggestInput = [doc.title, doc.authors?.name].filter(
          (item) => item
        );
        return {
          ...doc,
          suggest: suggestInput,
        };
      });
      totalIndexed += books.length;
      skip += BATCH_SIZE;
      console.log(`Progress: ${totalIndexed}/${totalBooks}`);
    }

    return sendResponse(
      res,
      200,
      "success",
      {
        index: booksIndex,
        documentsIndexed: totalIndexed,
        totalInDB: totalBooks,
      }
    );
  } catch (error: any) {
    console.error("Error creating books index:", error);
    return sendResponse(
      res,
      500,
      "error",
      error.message
    );
  }
};

export { createBookCopiesIndex, createBooksIndex };

