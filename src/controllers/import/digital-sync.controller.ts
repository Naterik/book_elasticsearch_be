import { Request, Response } from "express";
import { prisma } from "configs/client";
import { PreviewStatus } from "@prisma/client";
import { sendResponse } from "src/utils";
import { getJSON, sleep } from "./import.helpers";

/**
 * Syncs digital preview status for all books using OpenLibrary API.
 * 
 * Logic:
 * 1. Fetch all ISBNs from Book table.
 * 2. Process in batches to avoid overwhelming the API or database.
 * 3. Call OpenLibrary API for each ISBN.
 * 4. details.preview == "noview" -> NO_VIEW
 *    details.preview == "full" -> FULL
 *    details.preview == "restricted" (or others) -> RESTRICTED
 * 5. Upsert into DigitalBook.
 */
export const syncDigitalBooks = async (req: Request, res: Response) => {
  try {
    const BATCH_SIZE = 20; // safe batch size
    
    // 1. Get all ISBNs
    const books = await prisma.book.findMany({
      select: {
        id: true,
        isbn: true,
      },
      where: {
        isbn: { not: "" },
      },
    });

    if (books.length === 0) {
      return sendResponse(res, 200, "success");
    }

    console.log(`[DigitalSync] Found ${books.length} books to sync.`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // 2. Process in batches
    for (let i = 0; i < books.length; i += BATCH_SIZE) {
      const batch = books.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (book) => {
        try {
            if (!book.isbn) return;

            const apiUrl = `https://openlibrary.org/api/volumes/brief/isbn/${book.isbn}.json`;
            
            // External API Call using helper
            let data: any = {};
            try {
               data = await getJSON(apiUrl);
            } catch (fetchErr) {
               console.warn(`[DigitalSync] Failed to fetch for ISBN ${book.isbn}`);
               return; 
            }

            // Determine Status
            let status: PreviewStatus = PreviewStatus.NO_VIEW;
            let previewUrl = null;

            if (data && data.records) {
              const keys = Object.keys(data.records);
              if (keys.length > 0) {
                const record = data.records[keys[0]];
                if (record.details) {
                  const preview = record.details.preview;
                  previewUrl = record.details.preview_url;

                  if (preview === "noview") {
                    status = PreviewStatus.NO_VIEW;
                  } else if (preview === "full") {
                    status = PreviewStatus.FULL;
                  } else {
                    status = PreviewStatus.RESTRICTED;
                  }
                }
              }
            }

            // Database Update (Upsert)
            await prisma.digitalBook.upsert({
              where: { bookId: book.id },
              create: {
                bookId: book.id,
                status: status,
                previewUrl: previewUrl,
              },
              update: {
                status: status,
                previewUrl: previewUrl,
              },
            });

            processedCount++;
        } catch (err: any) {
          console.error(`[DigitalSync] Error processing ISBN ${book.isbn}:`, err.message);
          errorCount++;
          errors.push({ isbn: book.isbn, error: err.message });
        }
      });

      await Promise.all(batchPromises);
      await sleep(200);
    }

    return sendResponse(res, 200, "success", {
      total: books.length,
      processed: processedCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    return sendResponse(res, 500, "error", error.message);
  }
};
