import { client } from "configs/elastic";
import { BOOK_INDEX_SETTINGS, BOOK_INDEX_MAPPING, BOOK_COPY_INDEX_MAPPING } from "src/config/elastic.schema";
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
    console.log("Creating book_copies index with smart search settings...");

    const exists = await client.indices.exists({ index: bookCopiesIndex });
    const totalBookCopies = await countBookCopies();
    console.log(`Total book copies in DB: ${totalBookCopies}`);

    if (exists) {
        // If re-indexing strategy is DELETE -> CREATE, uncomment delete line. 
        // For now, if it exists, clear it to apply new settings (Development mode)
        // OR: Just return existing if you don't want to wipe.
        // Assuming user wants to apply new schema:
        console.log(`Index ${bookCopiesIndex} exists. Deleting to apply new Smart Search schema...`);
        await client.indices.delete({ index: bookCopiesIndex });
    }

    // Create new index with SHARED settings from Books (Edge N-gram)
    await client.indices.create({
      index: bookCopiesIndex,
      settings: BOOK_INDEX_SETTINGS as any, // Reuse the same analyzer settings!
      mappings: BOOK_COPY_INDEX_MAPPING as any,
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

      settings: BOOK_INDEX_SETTINGS as any,
      mappings: BOOK_INDEX_MAPPING as any,
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

