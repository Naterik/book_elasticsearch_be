import { client } from "configs/elastic";
import { Request, Response } from "express";
import { handleAllBookcopy } from "services/book/book-copy.services";
import { allBook, handleGetAllBooks } from "services/book/book.services";

const index = process.env.INDEX_N_GRAM!;
const indexc = process.env.INDEX_C!;

// Create index for book_copies with ngram tokenizer
const createIndex = async (req: Request, res: Response) => {
  try {
    console.log("Creating book_copies index with ngram tokenizer...");

    // Check if index exists and delete it
    const exists = await client.indices.exists({ index: indexc });
    if (exists) {
      await client.indices.delete({ index: indexc });
      console.log(`Deleted existing index: ${indexc}`);
    }

    // Create new index with ngram settings
    const createIndexResponse = await client.indices.create({
      index: indexc,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        "index.max_ngram_diff": 50,
        analysis: {
          analyzer: {
            ngram_analyzer: {
              type: "custom",
              tokenizer: "ngram_tokenizer",
              filter: ["lowercase", "stop"],
            },
            standard_analyzer: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase"],
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
          // Nested book details
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
          // Author details
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

    console.log("Index created successfully");

    // Fetch and index all book copies
    const bookCopies = await handleAllBookcopy();
    console.log(`Fetched ${bookCopies.length} book copies`);

    // Bulk index the documents
    if (bookCopies.length > 0) {
      const operations = bookCopies.flatMap((doc) => [
        { index: { _index: indexc } },
        doc,
      ]);

      const bulkResponse = await client.bulk({
        refresh: true,
        operations,
      });

      console.log(
        `Bulk indexed ${bookCopies.length} documents, errors: ${bulkResponse.errors}`
      );

      res.status(200).json({
        message: "Index created and populated successfully",
        index: indexc,
        documentsIndexed: bookCopies.length,
        bulkResponse,
      });
    } else {
      res.status(200).json({
        message: "Index created successfully but no documents to index",
        index: indexc,
      });
    }
  } catch (error: any) {
    console.error("Error creating index:", error);
    res.status(500).json({
      error: "Failed to create index",
      message: error.message,
    });
  }
};

const createIndexWithToken = async (req: Request, res: Response) => {
  try {
    const tokenizer = process.env.TOKEN_N_GRAM!;
    const oldIndex = process.env.INDEX_OLD!;

    console.log("Creating books index with edge ngram tokenizer...");

    // Check if index exists and delete it
    const exists = await client.indices.exists({ index });
    if (exists) {
      await client.indices.delete({ index });
      console.log(`Deleted existing index: ${index}`);
    }

    // Create new index with edge ngram settings for books
    const ngramIndex = await client.indices.create({
      index,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        "index.max_ngram_diff": 50,
        analysis: {
          analyzer: {
            autocomplete_index: {
              type: "custom",
              tokenizer: "edge_ngram_tokenizer",
              filter: ["lowercase", "stop"],
            },
            autocomplete_search: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase"],
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
            },
          },
          title_suggest: { type: "completion", preserve_separators: true },
          author_suggest: { type: "completion", preserve_separators: true },
        },
      },
    });

    console.log("Books index created successfully");
    await client.indices.refresh({ index });

    // Reindex from old index if it exists
    console.log(`Reindexing from ${oldIndex} to ${index}`);
    try {
      const oldIndexExists = await client.indices.exists({ index: oldIndex });
      if (oldIndexExists) {
        await client.reindex({
          refresh: true,
          body: {
            source: {
              index: oldIndex,
            },
            dest: {
              index: index,
            },
          },
        });
        console.log("Reindexing completed successfully");
      } else {
        console.log(`Old index ${oldIndex} does not exist, skipping reindex`);
      }
    } catch (reindexError) {
      console.warn("Reindex operation had an issue:", reindexError);
    }

    res.status(200).json({
      message: "Books index created with ngram tokenizer successfully",
      index,
      data: ngramIndex,
    });
  } catch (error: any) {
    console.error("Error creating books index:", error);
    res.status(500).json({
      error: "Failed to create books index",
      message: error.message,
    });
  }
};

export { createIndex, createIndexWithToken };
