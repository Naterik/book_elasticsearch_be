import { client } from "configs/elastic";
import { BOOK_INDEX_SETTINGS, BOOK_INDEX_MAPPING, BOOK_COPY_INDEX_MAPPING } from "src/config/elastic.schema";
import { Request, Response } from "express";
import {
  countBookCopies,
  getBookCopiesBatch,
} from "services/book/book-copy.service";
import { countBooks, getBooksBatch } from "services/book/book.service";
import { sendResponse } from "src/utils";
import { prisma } from "configs/client";

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

// Safe Update (Zero Downtime)
const updateBooksIndexMapping = async (req: Request, res: Response) => {
  try {
    const booksIndex = process.env.INDEX_N_GRAM_BOOK || "books_index";
    console.log(`Starting Zero-Downtime Update for: ${booksIndex}`);

    // 1. Update Mapping (Add new fields only)
    // Avoid re-sending entire mapping to prevent conflicts
    /*
    await client.indices.putMapping({
      index: booksIndex,
      properties: {
        borrowed: { type: "long" },
        digitalBook: {
             properties: {
                  status: { type: "keyword" }
             }
        }
      }
    });
    console.log("Index Mapping Updated Successfully.");
    */

    // 2. Re-sync Data (Update documents in place)
    // We iterate all books and index them again. Elastic will update existing docs by ID.
    // This does NOT delete the doc, just updates it.
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
        
        // Ensure new fields are present in the doc sent to Elastic
        return {
            ...doc,
            digitalBook: { status: doc.digitalBook?.status },
            borrowed: doc.borrowed || 0,
            suggest: suggestInput
        };
      });

      totalIndexed += books.length;
      skip += BATCH_SIZE;
      console.log(`Update Progress: ${totalIndexed}/${totalBooks}`);
    }

    return sendResponse(res, 200, "success", {
        message: "Index updated without downtime",
        totalUpdated: totalIndexed
    });

  } catch (error: any) {
    console.error("Error updating books index:", error);
    return sendResponse(res, 500, "error", error.message);
  }
};


// Advanced Title Sanitizer
// Returns: { action: 'DELETE' | 'UPDATE' | 'KEEP', newTitle?: string }
const analyzeTitle = (title: string): { action: 'DELETE' | 'UPDATE' | 'KEEP', newTitle?: string } => {
    if (!title) return { action: 'DELETE' };

    let clean = title.trim();

    // 1. Fix Common Garbage Suffixes
    // e.g. "One Piece - ??", "Title ??", "Title - "
    // Regex: Matches " - ??" or " ??" or just "??" at the end, or trailing hyphens
    const original = clean;
    
    // Remove " - ??" or " ??" at the end
    clean = clean.replace(/(\s-\s\?\?|\s\?\?)+$/g, ""); 
    // Remove trailing "??" if it follows a space or non-word char (careful not to kill "What?")
    // But user specifically showed " - ??". Let's be safe: 
    // pattern: <space>??<end> or <space>-<space>??<end>
    
    // Also remove trailing " -"
    clean = clean.replace(/\s+-\s*$/g, "");

    // 2. Check for "Meaningless" titles (Pure Symbols)
    // Add '?' to the list of symbols to strip
    const bare = clean.replace(/[-_.,!@#$%^&*()?:;"'{}[\]|\\/]/g, "").trim();
    
    // If nothing left, or only numbers (optional rule, but "1984" is valid. "1" might be valid.)
    // Let's stick to "Must have at least one alphanumeric char"
    if (bare.length === 0) return { action: 'DELETE' };

    // 3. New Checks for specific bad patterns
    if (clean.toLowerCase() === 'unknown' || clean.toLowerCase() === 'n/a') {
         return { action: 'DELETE' };
    }

    if (clean !== original) {
        return { action: 'UPDATE', newTitle: clean };
    }

    return { action: 'KEEP' };
}

const cleanupInvalidTitles = async (req: Request, res: Response) => {
    try {
        const booksIndex = process.env.INDEX_N_GRAM_BOOK || "books_index";
        console.log("Starting Advanced Title Cleanup...");

        // 1. Scan Books (using Elastic for speed, or DB)
        // Using Prisma is safer for "Source of Truth" but Elastic is faster for Text Search
        // Let's use Prisma to stream/chunk to ensure we catch everything in DB
        
        const totalBooks = await prisma.book.count();
        console.log(`Scanning ${totalBooks} books...`);

        const BATCH_SIZE = 1000;
        let processed = 0;
        let deletedCount = 0;
        let updatedCount = 0;
        
        const deletedExamples: string[] = [];
        const updatedExamples: string[] = [];

        // We can't easily stream ALL with Prisma findMany without cursor, 
        // but for <50k, skip/take is "okay". For rigorousness, use cursor.
        // Simplified: use ID pagination
        let cursorId: number | undefined;

        while (true) {
            const params: any = {
                take: BATCH_SIZE,
                orderBy: { id: 'asc' },
            };
            if (cursorId) {
                params.cursor = { id: cursorId };
                params.skip = 1;
            }

            const books = await prisma.book.findMany({
                ...params,
                select: { id: true, title: true }
            });

            if (books.length === 0) break;

            const toDeleteIds: number[] = [];
            const toUpdate: { id: number, title: string }[] = [];

            for (const book of books) {
                const result = analyzeTitle(book.title);
                
                if (result.action === 'DELETE') {
                    toDeleteIds.push(book.id);
                    if (deletedExamples.length < 5) deletedExamples.push(book.title);
                } else if (result.action === 'UPDATE' && result.newTitle) {
                    toUpdate.push({ id: book.id, title: result.newTitle });
                    if (updatedExamples.length < 5) updatedExamples.push(`${book.title} -> ${result.newTitle}`);
                }
            }

            // Perform Batch Operations
            
            // A. DELETE
            if (toDeleteIds.length > 0) {
                 await prisma.book.deleteMany({
                     where: { id: { in: toDeleteIds } }
                 });
                 await client.deleteByQuery({
                    index: booksIndex,
                    body: { query: { terms: { _id: toDeleteIds } } }
                });
                deletedCount += toDeleteIds.length;
            }

            // B. UPDATE
            if (toUpdate.length > 0) {
                // Prisma doesn't support bulk update with different values easily.
                // We must loop. For speed, use Promise.all with concurrency limit?
                // Or just loop sequentially for safety.
                for (const item of toUpdate) {
                    await prisma.book.update({
                        where: { id: item.id },
                        data: { title: item.title }
                    });
                    
                    // Partial Update Elastic
                    await client.update({
                        index: booksIndex,
                        id: String(item.id),
                        doc: { title: item.title }
                    });
                }
                updatedCount += toUpdate.length;
            }

            processed += books.length;
            cursorId = books[books.length - 1].id;
            
            if (processed % 5000 === 0) {
                 console.log(`Processed ${processed}/${totalBooks}...`);
            }
        }

        return sendResponse(res, 200, "success", {
            processed,
            deletedCount,
            updatedCount,
            deletedExamples,
            updatedExamples
        });

    } catch (error: any) {
        console.error("Cleanup Error:", error);
        return sendResponse(res, 500, "error", error.message);
    }
}

export { createBookCopiesIndex, createBooksIndex, updateBooksIndexMapping, cleanupInvalidTitles };

