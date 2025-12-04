import { client } from "configs/elastic";
import { Request, Response } from "express";
import { getAllBookCopies } from "services/book/book-copy.service";
import { getAllBooks } from "services/book/book.service";

const booksIndex = process.env.INDEX_N_GRAM_BOOK!;
const bookCopiesIndex = process.env.INDEX_BOOKCOPY!;
const createBookCopiesIndex = async (req: Request, res: Response) => {
  try {
    console.log("Creating book_copies index with ngram tokenizer...");

    const exists = await client.indices.exists({ index: bookCopiesIndex });
    if (exists) {
      console.log(
        `Index ${bookCopiesIndex} already exists, keeping existing data...`
      );

      const bookCopies = await getAllBookCopies();
      console.log(`Fetched ${bookCopies.length} book copies for update`);

      if (bookCopies.length > 0) {
        const operations = bookCopies.flatMap((doc) => [
          { index: { _index: bookCopiesIndex, _id: String(doc.id) } },
          doc,
        ]);

        const bulkResponse = await client.bulk({
          refresh: true,
          operations,
        });

        return res.status(200).json({
          message:
            "Book copies index updated successfully (existing data preserved)",
          index: bookCopiesIndex,
          documentsUpdated: bookCopies.length,
          bulkResponse,
        });
      }
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
    const bookCopies = await getAllBookCopies();
    console.log(`Fetched ${bookCopies.length} book copies`);

    // Bulk index the documents
    if (bookCopies.length > 0) {
      const operations = bookCopies.flatMap((doc) => [
        { index: { _index: bookCopiesIndex, _id: String(doc.id) } },
        doc,
      ]);

      const bulkResponse = await client.bulk({
        refresh: true,
        operations,
      });

      console.log(
        `Bulk indexed ${bookCopies.length} documents, errors: ${bulkResponse.errors}`
      );

      return res.status(200).json({
        message: "Book copies index created and populated successfully",
        index: bookCopiesIndex,
        documentsIndexed: bookCopies.length,
        bulkResponse,
      });
    } else {
      return res.status(200).json({
        message:
          "Book copies index created successfully but no documents to index",
        index: bookCopiesIndex,
      });
    }
  } catch (error: any) {
    console.error("Error creating book copies index:", error);
    res.status(500).json({
      error: "Failed to create book copies index",
      message: error.message,
    });
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

              filter: ["lowercase", "stop"],
            },

            autocomplete_search: {
              type: "custom",

              tokenizer: "standard",

              filter: ["lowercase"],
            },

            // Analyzer mới cho exact prefix match
            prefix_analyzer: {
              type: "custom",
              tokenizer: "keyword",
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
    const books = await getAllBooks();
    console.log(`Fetched ${books.length} books`);

    if (books.length > 0) {
      const operations = books.flatMap((doc) => {
        const suggestInput = [doc.title, doc.authors?.name].filter(
          (item) => item
        );
        return [
          { index: { _index: booksIndex, _id: String(doc.id) } },
          {
            ...doc,
            suggest: suggestInput,
          },
        ];
      });

      const bulkResponse = await client.bulk({
        refresh: true,
        operations,
      });

      if (bulkResponse.errors) {
        console.error("Bulk indexing had errors");
      }

      return res.status(200).json({
        index: booksIndex,
        documentsIndexed: books.length,
        bulkResponse,
      });
    } else {
      return res.status(200).json({
        index: booksIndex,
      });
    }
  } catch (error: any) {
    console.error("Error creating books index:", error);
    return res.status(500).json({
      error: "Failed to create books index",
      message: error.message,
    });
  }
};

export { createBookCopiesIndex, createBooksIndex };
