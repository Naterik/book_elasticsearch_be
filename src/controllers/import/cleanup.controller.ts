import { Request, Response } from "express";
import { prisma } from "configs/client";
import { sendResponse } from "src/utils";


/**
 * Controller: Clean Dirty Book Data
 * TiÃªu chÃ­ xÃ³a (OR logic):
 *  - ISBN báº¯t Ä‘áº§u báº±ng 'OL-'
 *  - ISBN káº¿t thÃºc báº±ng 'W'
 *  - ISBN khÃ´ng pháº£i sá»‘ (chá»©a chá»¯ cÃ¡i khÃ¡c)
 *  - Äá»™ dÃ i khÃ¡c 13
 *
 * Quy trÃ¬nh:
 *  1. QuÃ©t toÃ n bá»™ Book (Batching náº¿u cáº§n, nhÆ°ng delete where condition cÅ©ng Ä‘Æ°á»£c náº¿u DB máº¡nh)
 *     Tuy nhiÃªn, do cáº§n check logic string phá»©c táº¡p mÃ  Prisma raw filtering cÃ³ thá»ƒ háº¡n cháº¿,
 *     ta sáº½ fetch all scan hoáº·c dÃ¹ng raw query.
 *     NHÆ¯NG: Äá»ƒ an toÃ n vÃ  delete relations, ta nÃªn fetch ID sau Ä‘Ã³ delete transaction.
 */
export const cleanupBookData = async (req: Request, res: Response) => {
  try {
    console.log("ðŸ§¹ Starting Data Cleanup Job...");

    // BÆ°á»›c 1: TÃ¬m cÃ¡c Book ID cáº§n xÃ³a
    // Do Ä‘iá»u kiá»‡n phá»©c táº¡p, ta sáº½ fetch ISBN vÃ  ID Ä‘á»ƒ filter báº±ng Code (JS) cho linh hoáº¡t
    // LÆ°u Ã½: Náº¿u DB quÃ¡ lá»›n (>100k rows), cáº§n dÃ¹ng cursor/pagination.
    // Giáº£ sá»­ DB hiá»‡n táº¡i nhá» trung bÃ¬nh, ta fetch chunk.

    // TiÃªu chÃ­ tÃ¬m kiáº¿m sÆ¡ bá»™ qua Prisma (Ä‘á»ƒ giáº£m load)
    // KhÃ´ng dá»… filter 'length != 13' hay 'endsWith W' chuáº©n xÃ¡c 100% trong Prisma query standard
    // mÃ  khÃ´ng dÃ¹ng Raw Query. Ta sáº½ fetch háº¿t cÃ¡c cá»™t id, isbn.
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
      // Rule 3: Length !== 13 (Loáº¡i bá» ISBN-10, empty, etc)
      else if (isbn.length !== 13) shouldDelete = true;
      // Rule 4: Not numeric (contains non-digits)
      // Regex check: Náº¿u chá»©a kÃ½ tá»± khÃ´ng pháº£i sá»‘
      else if (!/^\d+$/.test(isbn)) shouldDelete = true;

      if (shouldDelete) {
        idsToDelete.push(book.id);
        isbnsToDelete.push(isbn);
      }
    }

    const count = idsToDelete.length;
    console.log(`ðŸ” Found ${count} invalid books to delete.`);

    if (count === 0) {
      return sendResponse(res, 200, "success", {
        deletedCount: 0,
      });
    }

    // BÆ°á»›c 2: Thá»±c hiá»‡n Delete an toÃ n vá»›i Transaction
    // Cáº§n xÃ³a cÃ¡c báº£ng con trÆ°á»›c:
    // Book -> BookCopy -> Loan -> (Fine, Payment)
    // Book -> Reservation
    // Book -> BooksOnGenres
    // Book -> DigitalBook (Cascade cÃ³ sáºµn nhÆ°ng cá»© include cho cháº¯c)

    // Chia nhá» batch Ä‘á»ƒ delete náº¿u sá»‘ lÆ°á»£ng quÃ¡ lá»›n (vÃ­ dá»¥ > 500)
    const BATCH_SIZE = 100;
    let deletedCount = 0;

    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batchIds = idsToDelete.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {
        // 1. Find BookCopies to delete Loans first
        const copies = await tx.bookcopy.findMany({
          where: { bookId: { in: batchIds } },
          select: { id: true },
        });
        const copyIds = copies.map((c) => c.id);

        if (copyIds.length > 0) {
          // Find Loans
          const loans = await tx.loan.findMany({
            where: { bookcopyId: { in: copyIds } },
            select: { id: true },
          });
          const loanIds = loans.map((l) => l.id);

          if (loanIds.length > 0) {
            // Delete Loan Relations (Fines, Payments usually linked to user/loan)
            // Check schema: Fine has loanId (unique), Payment has fineId (unique) or userId.
            // Payment -> User, Fine.
            // Fine -> Loan.

            // Delete Payments linked to Fines of these Loans
            // Find fines for these loans
            const fines = await tx.fine.findMany({
              where: { loanId: { in: loanIds } },
              select: { id: true },
            });
            const fineIds = fines.map((f) => f.id);

            if (fineIds.length > 0) {
              await tx.payment.deleteMany({
                where: { fineId: { in: fineIds } },
              });

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

        // 2. Delete Reservations
        await tx.reservation.deleteMany({
          where: { bookId: { in: batchIds } },
        });

        // 3. Delete BooksOnGenres
        await tx.booksOnGenres.deleteMany({
          where: { bookId: { in: batchIds } },
        });

        // 4. Delete DigitalBooks (if manual needed, though Cascade is set)
        await tx.digitalBook.deleteMany({
          where: { bookId: { in: batchIds } },
        });

        // 5. Finally Delete Books
        await tx.book.deleteMany({
          where: { id: { in: batchIds } },
        });
      });

      deletedCount += batchIds.length;
      console.log(`ðŸ—‘ï¸ Progress: Deleted ${deletedCount}/${count} records...`);
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
 * Danh sÃ¡ch cÃ¡c genre CHUNG NHáº¤T cáº§n giá»¯ láº¡i
 * Táº¥t cáº£ genre khÃ¡c sáº½ bá»‹ xÃ³a
 */
const ALLOWED_GENERAL_GENRES = [
  // Main Fiction Categories
  "Fiction",
  "Nonfiction",
  "Science Fiction",
  "Fantasy",
  "Romance",
  "Mystery",
  "Horror",
  "Thriller",
  "Suspense",
  "Adventure",
  "Drama",
  "Comedy",
  "Humor",

  // Literary Categories
  "Classics",
  "Classic Literature",
  "Literature",
  "Poetry",
  "Short Stories",
  "Essays",

  // Genre Fiction
  "Historical Fiction",
  "Crime Fiction",
  "Mystery Fiction",
  "Fantasy Fiction",
  "Romance Fiction",
  "Horror Fiction",
  "Suspense Fiction",
  "Psychological Fiction",
  "Gothic Fiction",

  // Age Categories
  "Children's Fiction",
  "Children's Stories",
  "Young Adult",
  "Young Adult Fiction",
  "Adult",

  // Non-Fiction Categories
  "History",
  "Biography",
  "Biography & Autobiography",
  "Autobiography",
  "Science",
  "Philosophy",
  "Psychology",
  "Religion",
  "Art",
  "Music",
  "Travel",
  "Education",
  "Business",
  "Economics",
  "Politics",
  "Law",
  "Health",
  "Medicine",
  "Technology",
  "Computers",
  "Mathematics",

  // Special Categories
  "Graphic Novels",
  "Comics & Graphic Novels",
  "Manga",
  "Picture Books",
  "Fairy Tales",
  "Folklore",
  "Mythology",

  // Popular Themes
  "Action & Adventure",
  "True Crime",
  "Self-Help",
  "Cooking",
  "Sports",
  "Nature",
  "Animals",
  "War Stories",
  "Love",
  "Family",
  "Friendship",

  // Format/Style
  "Contemporary",
  "Humorous Fiction",
  "Humorous Stories",
  "Ghost Stories",
  "Horror Stories",
  "Detective And Mystery Stories",
  "Adventure Stories",
];

/**
 * Controller: Clean up specific/unnecessary genres
 * Chá»‰ giá»¯ láº¡i cÃ¡c genre chung nháº¥t, xÃ³a táº¥t cáº£ genre riÃªng biá»‡t/khÃ´ng cáº§n thiáº¿t
 */
export const cleanupSpecificGenres = async (req: Request, res: Response) => {
  try {
    console.log("ðŸ§¹ Starting Smart Specific Genre Cleanup...");

    // Normalize allowed genres for case-insensitive comparison
    const allowedMap = new Map<string, string>(); // lowercase -> original Name
    ALLOWED_GENERAL_GENRES.forEach((g) => allowedMap.set(g.toLowerCase(), g));

    // 1. Get all genres from database
    const allGenres = await prisma.genre.findMany({
      select: { id: true, name: true },
    });

    console.log(`ðŸ“š Total genres in database: ${allGenres.length}`);

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

    console.log(`ðŸ—‘ï¸ Genres to delete entirely: ${genresToDelete.length}`);
    console.log(`ðŸ”„ Genres to reassign & delete: ${genresToReassign.length}`);
    console.log(`âœ… Genres to keep: ${keptGenres.length}`);

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

    // 4c. Orphan Cleanup (Optional but good) - Remove any genres with 0 books?
    // User didn't explicitly ask, but "tidy up" implies it.
    // The previous logic already deleted specific genres.
    // We can run a quick orphan check or just return.

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


