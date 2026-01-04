import { PreviewStatus } from "@prisma/client";
import { prisma } from "configs/client";



/**
 * Interface definition for OpenLibrary API Response structure
 * specific to what we need for preview logic.
 */
interface OpenLibraryPreviewResponse {
  records?: {
    [key: string]: {
      details?: {
        preview?: string;
        preview_url?: string;
      };
    };
  };
}

/**
 * Service function to process and upsert DigitalBook preview status.
 * 
 * @param isbn - The ISBN of the book to update.
 * @param apiData - The JSON response from OpenLibrary API.
 */
export async function processDigitalPreview(
  isbn: string,
  apiData: OpenLibraryPreviewResponse
): Promise<void> {
  // 1. Validate Input
  if (!isbn || !apiData || !apiData.records) {
    throw new Error("Invalid Input: ISBN or API Data is missing.");
  }

  // 2. Find the Record Key (usually "/books/OL...")
  // The API returns a dynamic key like "/books/OL123M", we grab the first value.
  const recordKey = Object.keys(apiData.records)[0];
  if (!recordKey) {
     throw new Error("Invalid Input: No records found in API response.");
  }

  const record = apiData.records[recordKey];
  if (!record.details) {
    // If details missing, we can't determine preview, so we might skip or set NO_VIEW.
    // Requirement says: "Ensure error handling if API doesn't return details".
    console.warn(`[DigitalPreview] No details found for ISBN: ${isbn}`);
    return;
  }

  const { preview, preview_url } = record.details;

  // 3. Mapping Logic
  let status: PreviewStatus  = PreviewStatus.NO_VIEW;
  let finalPreviewUrl: string | null = null;

  if (preview === "noview") {
    status = PreviewStatus.NO_VIEW;
    finalPreviewUrl = null; // "Không cần lưu previewUrl"
  } else if (preview === "full") {
    status = PreviewStatus.FULL;
    finalPreviewUrl = preview_url || null;
  } else {
    // Case: "restricted", "borrow", "lendable" or any others
    status = PreviewStatus.RESTRICTED;
    finalPreviewUrl = preview_url || null;
  }

  // 4. Upsert to Database
  // First, find the Book ID by ISBN
  const book = await prisma.book.findUnique({
    where: { isbn: isbn },
    select: { id: true }
  });

  if (!book) {
    console.warn(`[DigitalPreview] Book not found in DB with ISBN: ${isbn}`);
    return;
  }

  await prisma.digitalBook.upsert({
    where: { bookId: book.id },
    create: {
      bookId: book.id,
      status: status,
      previewUrl: finalPreviewUrl
    },
    update: {
      status: status,
      previewUrl: finalPreviewUrl
    }
  });

  console.log(`[DigitalPreview] Updated ISBN ${isbn} -> Status: ${status}`);
}


export const previewDigitalBook = async (isbn: string) => {
  const book = await prisma.book.findUnique({
    where: { isbn: isbn },
    select: { id: true }
  });

  if (!book) {
    throw new Error(`[DigitalPreview] Book not found in DB with ISBN: ${isbn}`);
  }

  const digitalBook = await prisma.digitalBook.findUnique({
    where: { bookId: book.id },
    select: { status: true, previewUrl: true }
  });

  if (!digitalBook) {
    throw new Error(`[DigitalPreview] Digital Book not found for ISBN: ${isbn}`);
  }

  return digitalBook;
}