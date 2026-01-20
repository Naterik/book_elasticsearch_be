
import { prisma } from "configs/client";
import { Request, Response } from "express";
import { sendResponse } from "src/utils";

/**
 * Audit Tool: Checks for inconsistencies between Catalog (Book) and Inventory (BookCopy)
 * Recommended to run this periodically or via Admin Dashboard
 */
export const checkInventoryConsistency = async (req: Request, res: Response) => {
  try {
    // 1. Get all books
    const books = await prisma.book.findMany({
      select: { id: true, title: true, quantity: true }
    });

    const discrepancies = [];

    // 2. Iterate and check against Copy Count
    // Note: For large datasets, this should be optimized to a raw SQL GroupBy query
    for (const book of books) {
      const realCount = await prisma.bookcopy.count({
        where: {
          bookId: book.id,
          status: { not: "LOST" } // Assuming LOST books don't count towards 'Quantity Available/Managing'
                                  // Adjust logic depending on your 'quantity' definition
        }
      });

      if (book.quantity !== realCount) {
        discrepancies.push({
          bookId: book.id,
          title: book.title,
          catalogQuantity: book.quantity,
          realPhysicalCount: realCount,
          status: "MISMATCH"
        });
      }
    }

    if (discrepancies.length === 0) {
        return sendResponse(res, 200, "success", {
            status: "HEALTHY",
            message: "All book quantities match physical copies."
        });
    }

    return sendResponse(res, 200, "error", {
        status: "DISCREPANCY_FOUND",
        totalMismatches: discrepancies.length,
        details: discrepancies,
        action: "Please use /sync-inventory endpoint to fix these issues."
    });

  } catch (error: any) {
    return sendResponse(res, 500, "error", error.message);
  }
};

/**
 * Fix Tool: Updates Book.quantity to match confirmed BookCopy count
 */
export const syncInventory = async (req: Request, res: Response) => {
    try {
        const books = await prisma.book.findMany({ select: { id: true } });
        let updatedCount = 0;

        for (const book of books) {
             const realCount = await prisma.bookcopy.count({
                where: { bookId: book.id, status: { not: "LOST" } }
             });

             // Update directly
             await prisma.book.update({
                 where: { id: book.id },
                 data: { quantity: realCount }
             });
             updatedCount++;
        }

        return sendResponse(res, 200, "success", `Successfully synced quantity for ${updatedCount} books.`);

    } catch (error: any) {
        return sendResponse(res, 500, "error", error.message);
    }
}
