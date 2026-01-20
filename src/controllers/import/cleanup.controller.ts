import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";
import { ALLOWED_GENERAL_GENRES } from "./import.helpers";


/**
 * Controller: Clean Dirty Book Data
 * Tiêu chí xóa (OR logic):
 *  - ISBN bắt đầu bằng 'OL-'
 *  - ISBN kết thúc bằng 'W'
 *  - ISBN không phải số (chứa chữ cái khác)
 *  - Độ dài khác 13
 *
 * Quy trình:
 *  1. Quét toàn bộ Book (Batching nếu cần, nhưng delete where condition cũng được nếu DB mạnh)
 *     Tuy nhiên, do cần check logic string phức tạp mà Prisma raw filtering có thể hạn chế,
 *     ta sẽ fetch all scan hoặc dùng raw query.
 *     NHƯNG: Để an toàn và delete relations, ta nên fetch ID sau đó delete transaction.
 */
export const cleanupBookData = async (req: Request, res: Response) => {
  try {
    console.log("🧹 Starting Data Cleanup Job...");

    // Bước 1: Tìm các Book ID cần xóa
    // Do điều kiện phức tạp, ta sẽ fetch ISBN và ID để filter bằng Code (JS) cho linh hoạt
    // Lưu ý: Nếu DB quá lớn (>100k rows), cần dùng cursor/pagination.
    // Giả sử DB hiện tại nhỏ trung bình, ta fetch chunk.

    // Tiêu chí tìm kiếm sơ bộ qua Prisma (để giảm load)
    // Không dễ filter 'length != 13' hay 'endsWith W' chuẩn xác 100% trong Prisma query standard
    // mà không dùng Raw Query. Ta sẽ fetch hết các cột id, isbn.
    const allBooks = await prisma.book.findMany({
      select: { id: true, isbn: true },
    });

    const idsToDelete: number[] = [];
    const isbnsToDelete: string[] = [];

    for (const book of allBooks) {
      const isbn = book.isbn.trim();
      let shouldDelete = false;

      // Rule 1: Starts with 'OL-'
      if (isbn.startsWith("OL-")) shouldDelete = true;
      // Rule 2: Ends with 'W'
      else if (isbn.endsWith("W")) shouldDelete = true;
      // Rule 3: Length !== 13 (Loại bỏ ISBN-10, empty, etc)
      else if (isbn.length !== 13) shouldDelete = true;
      // Rule 4: Not numeric (contains non-digits)
      // Regex check: Nếu chứa ký tự không phải số
      else if (!/^\d+$/.test(isbn)) shouldDelete = true;

      if (shouldDelete) {
        idsToDelete.push(book.id);
        isbnsToDelete.push(isbn);
      }
    }

    const count = idsToDelete.length;
    console.log(`🔍 Found ${count} invalid books to delete.`);

    if (count === 0) {
      return sendResponse(res, 200, "success", {
        deletedCount: 0,
      });
    }

    // Bước 2: Thực hiện Delete an toàn với Transaction
    // Cần xóa các bảng con trước:
    // Book -> BookCopy -> Loan -> (Fine, Payment)
    // Book -> BooksOnGenres
    // Book -> DigitalBook (Cascade có sẵn nhưng cứ include cho chắc)

    // Chia nhỏ batch để delete nếu số lượng quá lớn (ví dụ > 500)
    const BATCH_SIZE = 100;
    let deletedCount = 0;

    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batchIds = idsToDelete.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {
        await deleteBookRelations(tx, batchIds);
      });

      deletedCount += batchIds.length;
      console.log(`🗑️ Progress: Deleted ${deletedCount}/${count} records...`);
    }

    return sendResponse(res, 200, "success", {
      totalFound: count,
      deletedCount: deletedCount,
      examples: isbnsToDelete.slice(0, 5), // Show first 5 deleted ISBNs
    });
  } catch (error: any) {
    console.error("Cleanup Error:", error);
     return sendResponse(res, 500, "error", error.message);
  }
};


// ================= CLEANUP SPECIFIC GENRES =================

/**
 * Controller: Clean up specific/unnecessary genres
 * Chỉ giữ lại các genre chung nhất, xóa tất cả genre riêng biệt/không cần thiết
 */
export const cleanupSpecificGenres = async (req: Request, res: Response) => {
  try {
    console.log("🧹 Starting Smart Specific Genre Cleanup...");

    // Normalize allowed genres for case-insensitive comparison
    const allowedMap = new Map<string, string>(); // lowercase -> original Name
    ALLOWED_GENERAL_GENRES.forEach((g) => allowedMap.set(g.toLowerCase(), g));

    // 1. Get all genres from database
    const allGenres = await prisma.genre.findMany({
      select: { id: true, name: true },
    });

    console.log(`📚 Total genres in database: ${allGenres.length}`);

    const genresToDelete: number[] = [];
    const genresToReassign: { oldId: number; targetName: string }[] = [];
    const keptGenres: string[] = [];

    // 2. Classify Genres
    for (const genre of allGenres) {
      const lowerName = genre.name.toLowerCase();

      // Case A: Exactly Allowed
      if (allowedMap.has(lowerName)) {
        keptGenres.push(genre.name);
        continue;
      }

      // Case B: Try to Simplify
      // Heuristic: Split by common separators to find a base genre
      // Separators: (parentheses), -- (subdivisions), , (commas), . (dots like 'United States. Congress')
      const parts = genre.name.split(/[\(--,.]/);
      const simpleName = parts[0].trim();
      const simpleLower = simpleName.toLowerCase();

      // If the simplified base name is in our allowed list, we preserve the books by moving them
      if (simpleLower.length > 0 && allowedMap.has(simpleLower)) {
        genresToReassign.push({
          oldId: genre.id,
          targetName: allowedMap.get(simpleLower)!,
        });
      } else {
        // Case C: Garbage / Too Specific / Not Allowed -> Delete
        // Examples: "United States. Congress", "Collected works...", "Random String"
        genresToDelete.push(genre.id);
      }
    }

    console.log(`🗑️ Genres to delete entirely: ${genresToDelete.length}`);
    console.log(`🔄 Genres to reassign & delete: ${genresToReassign.length}`);
    console.log(`✅ Genres to keep: ${keptGenres.length}`);

    if (genresToDelete.length === 0 && genresToReassign.length === 0) {
      return sendResponse(res, 200, "success", {
        totalGenres: allGenres.length,
        deletedCount: 0,
        reassignedCount: 0,
      });
    }

    // 3. Prepare Target Genres for Reassignment
    // Ensure all target genres exist in the DB so we can link books to them
    const uniqueTargets = new Set(genresToReassign.map((g) => g.targetName));
    const targetGenreIds = new Map<string, number>();

    for (const targetName of uniqueTargets) {
      // Check if it already exists in 'allGenres' list
      const existing = allGenres.find(
        (g) => g.name.toLowerCase() === targetName.toLowerCase()
      );
      if (existing) {
        targetGenreIds.set(targetName, existing.id);
      } else {
        // Create matching allowed genre if missing
        const newGenre = await prisma.genre.create({
          data: {
            name: targetName,
            description: "Normalized General Genre (Auto-created)",
          },
        });
        targetGenreIds.set(targetName, newGenre.id);
      }
    }

    // Group reassignments by Target ID to batch operations
    const reassignGroups = new Map<number, number[]>(); // targetId -> oldIds[]

    for (const reassign of genresToReassign) {
      const targetId = targetGenreIds.get(reassign.targetName);
      if (!targetId) continue;
      const list = reassignGroups.get(targetId) || [];
      list.push(reassign.oldId);
      reassignGroups.set(targetId, list);
    }

    // 4. Execute Transaction
    await prisma.$transaction(
      async (tx) => {
        // 4a. Handle Reassignments (Move books -> Delete old genres)
        for (const [targetId, oldIds] of reassignGroups.entries()) {
          // Get all Book IDs associated with these old genres
          const oldRelations = await tx.booksOnGenres.findMany({
            where: { genreId: { in: oldIds } },
            select: { bookId: true },
          });

          const bookIds = Array.from(new Set(oldRelations.map((r) => r.bookId)));

          if (bookIds.length > 0) {
            // Link these books to the Target Genre
            await tx.booksOnGenres.createMany({
              data: bookIds.map((bid) => ({
                bookId: bid,
                genreId: targetId,
              })),
              skipDuplicates: true, // Important: Book might already have the target genre
            });
          }

          // Delete old relations
          await tx.booksOnGenres.deleteMany({
            where: { genreId: { in: oldIds } },
          });

          // Delete old genres
          await tx.genre.deleteMany({
            where: { id: { in: oldIds } },
          });
        }

        // 4b. Handle Pure Deletions (Just delete)
        if (genresToDelete.length > 0) {
          await tx.booksOnGenres.deleteMany({
            where: { genreId: { in: genresToDelete } },
          });
          await tx.genre.deleteMany({
            where: { id: { in: genresToDelete } },
          });
        }
      },
      {
        maxWait: 50000,
        timeout: 50000, // Increase timeout
      }
    );

    // 5. Response
    const finalGenres = await prisma.genre.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });

    return sendResponse(res, 200, "success", {
      totalGenresBefore: allGenres.length,
      deletedGenres: genresToDelete.length + genresToReassign.length,
      reassignedCount: genresToReassign.length,
      remainingGenres: finalGenres.length,
      reassignmentExamples: genresToReassign.slice(0, 5).map(g => `${allGenres.find(x=>x.id===g.oldId)?.name} -> ${g.targetName}`),
      deletedExamples: genresToDelete.slice(0, 5).map(id => allGenres.find(x=>x.id===id)?.name),
    });
  } catch (error: any) {
    return sendResponse(res, 500, "error", error.message);
  }

};

/**
 * Controller: Clean up books that have NO genres
 * Finds books with empty 'genres' (BooksOnGenres) and deletes them using the standard safe deletion logic.
 */
export const cleanupBooksNoGenres = async (req: Request, res: Response) => {
  try {
    console.log("🧹 Starting Cleanup of Books with NO Genres...");

    // 1. Find Books with 0 Genres
    const booksToDelete = await prisma.book.findMany({
      where: {
        genres: {
          none: {},
        },
      },
      select: { id: true },
    });

    const count = booksToDelete.length;
    console.log(`🔍 Found ${count} books with NO genres.`);

    if (count === 0) {
      return sendResponse(res, 200, "success", {
        found: 0,
        deletedCount: 0,
      });
    }

    const idsToDelete = booksToDelete.map((b) => b.id);
    const BATCH_SIZE = 100;
    let deletedCount = 0;

    // 2. Execute Deletion with Batching
    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batchIds = idsToDelete.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {
        await deleteBookRelations(tx, batchIds);
      });

      deletedCount += batchIds.length;
      console.log(`🗑️ Progress: Deleted ${deletedCount}/${count} books without genres...`);
    }

    return sendResponse(res, 200, "success", {
      found: count,
      deletedCount: deletedCount,
    });
  } catch (error: any) {
    console.error("Cleanup No Genres Error:", error);
    return sendResponse(res, 500, "error", error.message);
  }
};

/**
 * Shared Helper: Delete Books and their Relations transactionally
 * Can be reused by any cleanup controller.
 */
const deleteBookRelations = async (tx: any, bookIds: number[]) => {
  // 1. Find BookCopies to delete Loans first
  const copies = await tx.bookcopy.findMany({
    where: { bookId: { in: bookIds } },
    select: { id: true },
  });
  const copyIds = copies.map((c: any) => c.id);

  if (copyIds.length > 0) {
    // Find Loans
    const loans = await tx.loan.findMany({
      where: { bookcopyId: { in: copyIds } },
      select: { id: true },
    });
    const loanIds = loans.map((l: any) => l.id);

    if (loanIds.length > 0) {
      // Delete Loan Relations (Fines, Payments)

      // Find fines for these loans
      const fines = await tx.fine.findMany({
        where: { loanId: { in: loanIds } },
        select: { id: true },
      });
      const fineIds = fines.map((f: any) => f.id);

      if (fineIds.length > 0) {
        // Delete Payments linked to Fines
        await tx.payment.deleteMany({
          where: { fineId: { in: fineIds } },
        });

        // Delete Fines
        await tx.fine.deleteMany({
          where: { id: { in: fineIds } },
        });
      }

      // Delete Loans
      await tx.loan.deleteMany({
        where: { id: { in: loanIds } },
      });
    }

    // Delete BookCopies
    await tx.bookcopy.deleteMany({
      where: { id: { in: copyIds } },
    });
  }

  // 3. Delete BooksOnGenres
  await tx.booksOnGenres.deleteMany({
    where: { bookId: { in: bookIds } },
  });

  // 4. Delete DigitalBooks
  await tx.digitalBook.deleteMany({
    where: { bookId: { in: bookIds } },
  });

  // 5. Finally Delete Books
  await tx.book.deleteMany({
    where: { id: { in: bookIds } },
  });
};
