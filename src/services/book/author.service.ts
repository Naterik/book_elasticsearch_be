import { prisma } from "configs/client";
import "dotenv/config";

const getAllAuthors = async (currentPage: number,name?: string) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalAuthors = await prisma.author.count();
  const totalPages = Math.ceil(countTotalAuthors / +pageSize);
  const result = await prisma.author.findMany({
    skip,
    take: +pageSize,
    orderBy: { id: "desc" },
    where: {
      name: {
        contains: name || "",
      },
    },
  });

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +pageSize,
      totalItems: countTotalAuthors,
    },
  };
};

const checkAuthorNameExists = async (name: string) => {
  if (!name?.trim()) throw new Error("Author name is required");
  const exists = await prisma.author.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Author name already exists!");
};

const createAuthor = async (name: string, bio?: string) => {
  await checkAuthorNameExists(name);
  return prisma.author.create({
    data: { name, bio: bio ?? null },
  });
};

const updateAuthor = async (id: string, name: string, bio?: string) => {
  if (name) {
    await checkAuthorNameExists(name);
  }

  return prisma.author.update({
    where: { id: +id },
    data: {
      name,
      bio: bio ?? null,
    },
  });
};

const deleteAuthorService = async (id: string) => {
  const used = await prisma.book.count({ where: { authorId: +id } });
  if (used > 0) {
    throw new Error(
      "Cannot delete author: there are books referencing this author."
    );
  }

  return prisma.author.delete({ where: { id: +id } });
};

const getAuthorByIdService = async (id: number) => {
  return prisma.author.findUnique({
    where: { id },
    include: {
      books: true,
    },
  });
};

const createMultipleAuthors = async (
  authors: { name: string; bio?: string }[]
) => {
  const createAuthors = await prisma.author.createMany({
    data: authors,
    skipDuplicates: true,
  });
  return createAuthors;
};

const getAllAuthorsNoPagination = async () => {
  return prisma.author.findMany({
    orderBy: { name: "asc" },
  });
};

export {
  getAllAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthorService,
  createMultipleAuthors,
  getAuthorByIdService,
  getAllAuthorsNoPagination,
  performFullAuthorCleanup,
};

/**
 * Validate author name
 */
const isValidAuthor = (name: string): boolean => {
  const trimmedName = name.trim();

  if (trimmedName.length < 2) return false;

  const invalidPatterns = [
    /^\[.*\]$/,
    /^\(.*\)$/,
    /http[s]?:\/\//,
    /^\d+$/, // Only numbers
    /^by\s+/i, // "by Author Name"
    /\.(com|org|net)$/i,
    /^unknown$/i,
    /^anonymous$/i,
    /^\?+$/, // "???"
  ];

  if (invalidPatterns.some((p) => p.test(trimmedName))) return false;

  // Check for too many special chars
  const specialCharCount = (trimmedName.match(/[^a-zA-Z0-9\s\.\-]/g) || []).length;
  if (specialCharCount > 3) return false;

  return true;
};

/**
 * Remove orphan authors (no books)
 */
const cleanupOrphanAuthors = async () => {
  try {
    const allAuthors = await prisma.author.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { books: true },
        },
      },
    });

    const orphanAuthors = allAuthors.filter((a) => a._count.books === 0);
    const orphanIds = orphanAuthors.map((a) => a.id);

    if (orphanIds.length === 0) {
      return {
        message: "No orphan authors found",
        deletedCount: 0,
        names: [],
      };
    }

    const result = await prisma.author.deleteMany({
      where: { id: { in: orphanIds } },
    });

    return {
      message: `Deleted ${result.count} orphan authors`,
      deletedCount: result.count,
      names: orphanAuthors.map((a) => a.name),
    };
  } catch (error: any) {
    throw new Error(`Failed to cleanup orphan authors: ${error.message}`);
  }
};

/**
 * Remove invalid authors
 */
const cleanupInvalidAuthors = async () => {
  try {
    const allAuthors = await prisma.author.findMany({
      select: { id: true, name: true },
    });

    const invalidAuthors = allAuthors.filter((a) => !isValidAuthor(a.name));
    const invalidIds = invalidAuthors.map((a) => a.id);

    if (invalidIds.length === 0) {
      return {
        message: "No invalid authors found",
        deletedCount: 0,
        names: [],
      };
    }

    // Books with invalid authors need to be handled?
    // If we delete author, book needs author.
    // For now, let's assume strict cleanup: if author is invalid, we can't delete if they have books unless we reassign 'Unknown' or delete books.
    // However, genre cleanup deleted relations. Books need valid authorId.
    // We should only delete invalid authors if they are orphans OR we can reassign.
    // To match Genre logic (which deleted relations), we might need to be careful.
    // But Genre logic deleted `BooksOnGenres`. Author is a required relation on Book?
    // Checking schema: `authorId Int` (required).
    // So we CANNOT delete author if they have books.
    // We must check usage first.

    // Re-check orphan status for invalid ones or just skip used ones.
    const usedAuthors = await prisma.book.findMany({
      where: { authorId: { in: invalidIds } },
      select: { authorId: true },
      distinct: ["authorId"],
    });
    const usedAuthorIds = new Set(usedAuthors.map((b) => b.authorId));

    const authorsToDelete = invalidIds.filter((id) => !usedAuthorIds.has(id));

    if (authorsToDelete.length === 0) {
      return {
        message: "Found invalid authors but all are in use, cannot delete",
        deletedCount: 0,
        names: [],
      };
    }

    const result = await prisma.author.deleteMany({
      where: { id: { in: authorsToDelete } },
    });

    return {
      message: `Deleted ${result.count} invalid (unused) authors`,
      deletedCount: result.count,
      names: invalidAuthors.filter((a) => authorsToDelete.includes(a.id)).map((a) => a.name),
    };
  } catch (error: any) {
    throw new Error(`Failed to cleanup invalid authors: ${error.message}`);
  }
};

/**
 * Merge duplicate authors
 */
const cleanupDuplicateAuthors = async () => {
  try {
    const allAuthors = await prisma.author.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const authorMap = new Map<string, Array<{ id: number; name: string }>>();

    allAuthors.forEach((a) => {
      const normalized = a.name.toLowerCase().trim().replace(/\s+/g, " ");
      if (!authorMap.has(normalized)) {
        authorMap.set(normalized, []);
      }
      authorMap.get(normalized)!.push(a);
    });

    const duplicates = Array.from(authorMap.entries()).filter(
      ([_, list]) => list.length > 1
    );

    if (duplicates.length === 0) {
      return {
        message: "No duplicate authors found",
        mergedCount: 0,
        deletedCount: 0,
      };
    }

    let deletedCount = 0;
    let mergedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const [_, list] of duplicates) {
        const keepId = list[0].id;
        const removeIds = list.slice(1).map((a) => a.id);

        // Move books to keepId
        const updatedBooks = await tx.book.updateMany({
          where: { authorId: { in: removeIds } },
          data: { authorId: keepId },
        });
        mergedCount += updatedBooks.count;

        // Delete removed authors
        const deleted = await tx.author.deleteMany({
          where: { id: { in: removeIds } },
        });
        deletedCount += deleted.count;
      }
    });

    return {
      message: `Merged ${duplicates.length} groups`,
      mergedCount,
      deletedCount,
    };
  } catch (error: any) {
    throw new Error(`Failed to cleanup duplicate authors: ${error.message}`);
  }
};

/**
 * Normalize names
 */
const normalizeAuthorNames = async () => {
  try {
    const allAuthors = await prisma.author.findMany({
      select: { id: true, name: true },
    });

    let updatedCount = 0;

    for (const author of allAuthors) {
      const normalized = author.name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
        .trim();

      if (normalized !== author.name && isValidAuthor(normalized)) {
         // Check if normalized name already exists (conflict)
         const limit = await prisma.author.count({ where: { name: normalized }});
         if (limit === 0) {
            await prisma.author.update({
              where: { id: author.id },
              data: { name: normalized },
            });
            updatedCount++;
         }
      }
    }

    return {
      message: `Normalized ${updatedCount} author names`,
      updatedCount,
    };
  } catch (error: any) {
    throw new Error(`Failed to normalize author names: ${error.message}`);
  }
};

const performFullAuthorCleanup = async () => {
  console.log("Starting Author Cleanup...");
  
  // 1. Orphan
  const orphan = await cleanupOrphanAuthors();
  console.log("Orphan:", orphan);

  // 2. Invalid (Unused)
  const invalid = await cleanupInvalidAuthors();
  console.log("Invalid:", invalid);

  // 3. Duplicates
  const duplicates = await cleanupDuplicateAuthors();
  console.log("Duplicates:", duplicates);

  // 4. Normalize
  const normalized = await normalizeAuthorNames();
  console.log("Normalized:", normalized);

  return {
    orphan,
    invalid,
    duplicates,
    normalized,
    success: true,
  };
};
