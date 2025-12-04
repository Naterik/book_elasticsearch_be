import { prisma } from "configs/client";
import "dotenv/config";

/**
 * Lọc các genre có ý nghĩa thực sự
 * Loại bỏ metadata tags, ký tự đặc biệt, và text không có nghĩa
 */
const isValidGenre = (name: string): boolean => {
  const trimmedName = name.trim();

  // Loại bỏ các pattern rõ ràng không hợp lệ
  const invalidPatterns = [
    /^\[.*\]$/, // [series:...], [guide]
    /^series:/i, // series:...
    /^\(.*\)$/, // (Robert C.)
    /^\{.*\}$/, // {acute}Ecoles
    /\{acute\}/i, // {acute}Ecoles
    /\{[^}]+\}/, // Bất kỳ text trong {}
    /^acute:/i, // acute:...
    /^\*.*$/, // *1965, *Age 3-7
    /^&/, // & criticism, & scanning
    /^\$/, // $8.95
    /^\d+\.\d+\s+/, // 08.21 Ancient philosophy
    /^\d+\s+(Orig\.|Copyright|Anniversary)/i,
    /^from\s+old\s+catalog/i,
    /^récit\s+de\s+voyage/i,
    /Gesamtdarstellung/i,
    /\.(com|org|net)$/i, // Domain names
    /^--\s/, // "-- Fiction"
    /--/, // "Abolitionists--biography" (chứa dấu --)
    /^,/, // Bắt đầu bằng dấu phẩy
    /,.*,/, // Chứa nhiều dấu phẩy (danh sách ghép)
    /^AR\s+\d+/i, // AR 8.6
    /^Ps\d+/i, // Ps2116 .t8 1998
    /^\d{3,}\//, // 813/.4 (Dewey Decimal)
    /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿœ]/i, // Ký tự có dấu
    /^[A-Z]{2,}\s+\/\s+/, // FICTION / Classics
    /^\d+-\d+\s+years/i, // 0-5 years; Home
    /;\s*\w+/, // Chứa dấu chấm phẩy + text
    /,\s*[a-z]/, // "Baggins, frodo" (tên người)
  ];

  if (invalidPatterns.some((pattern) => pattern.test(trimmedName))) {
    return false;
  }

  // Loại bỏ nếu quá ngắn
  if (trimmedName.length < 3) {
    return false;
  }

  // Loại bỏ nếu chứa quá nhiều ký tự đặc biệt (chỉ cho phép tối đa 1)
  const specialCharCount = (trimmedName.match(/[^a-zA-Z0-9\s-]/g) || []).length;
  if (specialCharCount > 1) {
    return false;
  }

  // Loại bỏ nếu chứa dấu phẩy (thường là tên người hoặc metadata)
  if (trimmedName.includes(",")) {
    return false;
  }

  // Loại bỏ nếu chứa dấu chấm phẩy
  if (trimmedName.includes(";")) {
    return false;
  }

  // Loại bỏ nếu chứa dấu ngoặc nhọn
  if (trimmedName.includes("{") || trimmedName.includes("}")) {
    return false;
  }

  // Loại bỏ nếu bắt đầu bằng số hoặc có pattern số.số
  if (/^\d/.test(trimmedName) || /\d+\.\d+/.test(trimmedName)) {
    return false;
  }

  // Loại bỏ nếu bắt đầu hoặc kết thúc bằng dấu chấm
  if (/^[.]|[.]$/.test(trimmedName)) {
    return false;
  }

  // Loại bỏ các từ không phải tiếng Anh chuẩn
  const nonEnglishWords = [
    // Tiếng Pháp
    "gouvernantes",
    "jeunes",
    "femmes",
    "frères",
    "soeurs",
    "familles",
    "mères",
    "filles",
    "sœurs",
    "famille",
    "enfants",
    "ecoles",
    // Tiếng Tây Ban Nha
    "madres",
    "hijas",
    "jóvenes",
    "mujeres",
    "materiales",
    "español",
    "novela",
    "juvenil",
    "hermanos",
    // Tiếng Trung
    "chang",
    "pian",
    "xiao",
    "shuo",
    "zhang",
    // Tiếng Đức
    "absturzunfall",
    "abwasser",
    "afwijkingen", // Hà Lan
    "aangeboren", // Hà Lan
    "gesamtdarstellung",
    "unfall",
    "afwijking",
  ];

  const lowerName = trimmedName.toLowerCase();
  if (nonEnglishWords.some((word) => lowerName.includes(word))) {
    return false;
  }

  // Loại bỏ nếu có quá nhiều từ (metadata thường nhiều từ)
  const words = trimmedName.split(/\s+/);
  if (words.length > 4) {
    return false;
  }

  // Phải chứa ít nhất 60% chữ cái (tăng từ 50% lên 60%)
  const letterCount = (trimmedName.match(/[a-zA-Z]/g) || []).length;
  const letterRatio = letterCount / trimmedName.length;
  if (letterRatio < 0.6) {
    return false;
  }

  return true;
};

const getGenresForDisplay = async () => {
  const allGenres = await prisma.genre.findMany({
    select: { name: true, id: true },
    orderBy: { name: "asc" },
  });

  // Lọc chỉ lấy các genre có ý nghĩa
  const validGenres = allGenres.filter((genre) => isValidGenre(genre.name));

  // Loại bỏ duplicate (case-insensitive)
  const uniqueGenres = validGenres.filter(
    (genre, index, self) =>
      index ===
      self.findIndex((g) => g.name.toLowerCase() === genre.name.toLowerCase())
  );

  return uniqueGenres;
};

const getAllGenres = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalGenres = await prisma.genre.count();
  const totalPages = Math.ceil(countTotalGenres / +pageSize);
  const result = await prisma.genre.findMany({
    skip,
    take: +pageSize,
    orderBy: { id: "desc" },
  });

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +pageSize,
      totalItems: countTotalGenres,
    },
  };
};

const checkGenreNameExists = async (name: string) => {
  if (!name?.trim()) throw new Error("Genre name is required");
  const exists = await prisma.genre.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Genre name already exists!");
};

const createGenre = async (name: string, description: string) => {
  await checkGenreNameExists(name);
  return prisma.genre.create({
    data: { name: name.trim(), description: description ?? "" },
  });
};

const updateGenre = async (id: string, name: string, description?: string) => {
  return prisma.genre.update({
    where: { id: +id },
    data: {
      name,
      description,
    },
  });
};

const deleteGenre = async (id: string) => {
  return prisma.genre.delete({ where: { id: +id } });
};

/**
 * Xóa các genre không có sách nào liên kết
 * Đây là các genre "orphan" - không được sử dụng bởi bất kỳ sách nào
 */
const cleanupOrphanGenres = async () => {
  try {
    // 1. Lấy tất cả genres kèm theo số lượng sách
    const allGenres = await prisma.genre.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { books: true },
        },
      },
    });

    // 2. Lọc ra các genre không có sách
    const orphanGenres = allGenres.filter((genre) => genre._count.books === 0);
    const orphanGenreIds = orphanGenres.map((g) => g.id);

    if (orphanGenreIds.length === 0) {
      return {
        message: "No orphan genres found",
        deletedGenresCount: 0,
        orphanGenreNames: [],
        success: true,
      };
    }

    // 3. Xóa các genre không có sách
    const result = await prisma.genre.deleteMany({
      where: {
        id: { in: orphanGenreIds },
      },
    });

    return {
      message: `Successfully deleted ${result.count} orphan genres (genres with no books)`,
      deletedGenresCount: result.count,
      orphanGenreNames: orphanGenres.map((g) => g.name),
      success: true,
    };
  } catch (error: any) {
    console.error("Error cleaning up orphan genres:", error);
    throw new Error(`Failed to cleanup orphan genres: ${error.message}`);
  }
};

/**
 * Xóa tất cả các genre "rác" và relationships liên quan
 * Bao gồm: BooksOnGenres
 */
const cleanupInvalidGenres = async () => {
  try {
    // 1. Lấy tất cả genres
    const allGenres = await prisma.genre.findMany({
      select: { id: true, name: true },
    });

    // 2. Lọc ra các genre không hợp lệ
    const invalidGenres = allGenres.filter(
      (genre) => !isValidGenre(genre.name)
    );
    const invalidGenreIds = invalidGenres.map((g) => g.id);

    if (invalidGenreIds.length === 0) {
      return {
        message: "No invalid genres found",
        deletedGenresCount: 0,
        deletedRelationsCount: 0,
        invalidGenreNames: [],
        success: true,
      };
    }

    // 3. Xóa trong transaction để đảm bảo data integrity
    const result = await prisma.$transaction(async (tx) => {
      // 3.1. Xóa relationships trong BooksOnGenres
      const deletedRelations = await tx.booksOnGenres.deleteMany({
        where: {
          genreId: { in: invalidGenreIds },
        },
      });

      // 3.2. Xóa các genre rác
      const deletedGenres = await tx.genre.deleteMany({
        where: {
          id: { in: invalidGenreIds },
        },
      });

      return {
        deletedGenresCount: deletedGenres.count,
        deletedRelationsCount: deletedRelations.count,
        invalidGenreNames: invalidGenres.map((g) => g.name),
      };
    });

    return {
      message: `Successfully deleted ${result.deletedGenresCount} invalid genres and ${result.deletedRelationsCount} book-genre relationships`,
      deletedGenresCount: result.deletedGenresCount,
      deletedRelationsCount: result.deletedRelationsCount,
      invalidGenreNames: result.invalidGenreNames,
      success: true,
    };
  } catch (error: any) {
    console.error("Error cleaning up invalid genres:", error);
    throw new Error(`Failed to cleanup invalid genres: ${error.message}`);
  }
};

/**
 * Xóa các genre trùng lặp (case-insensitive + similar names)
 * Ví dụ: "Badgers" vs "baggers", "Fiction" vs "fiction"
 * Giữ lại genre có ID nhỏ nhất (được tạo trước)
 */
const cleanupDuplicateGenres = async () => {
  try {
    const allGenres = await prisma.genre.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    // Tìm duplicates (case-insensitive + normalized comparison)
    const genreMap = new Map<
      string,
      Array<{ id: number; originalName: string }>
    >();

    allGenres.forEach((genre) => {
      // Normalize: lowercase + trim + remove extra spaces
      const normalizedName = genre.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

      if (!genreMap.has(normalizedName)) {
        genreMap.set(normalizedName, []);
      }
      genreMap.get(normalizedName)!.push({
        id: genre.id,
        originalName: genre.name,
      });
    });

    // Lọc ra các nhóm có nhiều hơn 1 genre (duplicates)
    const duplicateGroups = Array.from(genreMap.entries()).filter(
      ([_, genres]) => genres.length > 1
    );

    if (duplicateGroups.length === 0) {
      return {
        message: "No duplicate genres found",
        deletedGenresCount: 0,
        deletedRelationsCount: 0,
        mergedRelationsCount: 0,
        duplicateGroups: 0,
        examples: [],
        success: true,
      };
    }

    // IDs cần xóa (giữ lại ID đầu tiên, xóa các ID sau)
    const idsToDelete = duplicateGroups.flatMap(([_, genres]) =>
      genres.slice(1).map((g) => g.id)
    );

    // Chuẩn bị merge relationships: Di chuyển tất cả books từ genres trùng về genre chính
    const mergeOperations: Array<{ keepId: number; deleteIds: number[] }> = [];

    duplicateGroups.forEach(([_, genres]) => {
      const keepId = genres[0].id;
      const deleteIds = genres.slice(1).map((g) => g.id);
      mergeOperations.push({ keepId, deleteIds });
    });

    const result = await prisma.$transaction(async (tx) => {
      let totalMergedRelations = 0;

      // Di chuyển relationships từ duplicate genres sang main genre
      for (const op of mergeOperations) {
        // Lấy tất cả books liên kết với duplicate genres
        const booksToMerge = await tx.booksOnGenres.findMany({
          where: { genreId: { in: op.deleteIds } },
          select: { bookId: true },
        });

        // Tạo relationships mới cho main genre (nếu chưa tồn tại)
        for (const book of booksToMerge) {
          await tx.booksOnGenres.upsert({
            where: {
              bookId_genreId: {
                bookId: book.bookId,
                genreId: op.keepId,
              },
            },
            create: {
              bookId: book.bookId,
              genreId: op.keepId,
            },
            update: {}, // Không cần update nếu đã tồn tại
          });
          totalMergedRelations++;
        }
      }

      // Xóa relationships cũ của duplicate genres
      const deletedRelations = await tx.booksOnGenres.deleteMany({
        where: {
          genreId: { in: idsToDelete },
        },
      });

      // Xóa duplicate genres
      const deletedGenres = await tx.genre.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });

      return {
        deletedGenresCount: deletedGenres.count,
        deletedRelationsCount: deletedRelations.count,
        mergedRelationsCount: totalMergedRelations,
        duplicateGroups: duplicateGroups.length,
        examples: duplicateGroups.slice(0, 5).map(([norm, genres]) => ({
          normalized: norm,
          kept: genres[0].originalName,
          removed: genres.slice(1).map((g) => g.originalName),
        })),
      };
    });

    return {
      message: `Successfully merged ${result.duplicateGroups} duplicate genre groups, deleted ${result.deletedGenresCount} duplicate genres, merged ${result.mergedRelationsCount} book relationships`,
      deletedGenresCount: result.deletedGenresCount,
      deletedRelationsCount: result.deletedRelationsCount,
      mergedRelationsCount: result.mergedRelationsCount,
      duplicateGroups: result.duplicateGroups,
      examples: result.examples,
      success: true,
    };
  } catch (error: any) {
    console.error("Error cleaning up duplicate genres:", error);
    throw new Error(`Failed to cleanup duplicate genres: ${error.message}`);
  }
};

/**
 * Chuẩn hóa tên genre: Viết hoa chữ cái đầu mỗi từ
 */
const normalizeGenreNames = async () => {
  try {
    const allGenres = await prisma.genre.findMany({
      select: { id: true, name: true },
    });

    const updates = allGenres
      .filter((genre) => isValidGenre(genre.name))
      .map((genre) => {
        // Capitalize first letter of each word
        const normalized = genre.name
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ")
          .trim();

        return {
          id: genre.id,
          oldName: genre.name,
          newName: normalized,
          needsUpdate: genre.name !== normalized,
        };
      })
      .filter((item) => item.needsUpdate);

    if (updates.length === 0) {
      return {
        message: "All genre names are already normalized",
        updatedCount: 0,
        updates: [],
        success: true,
      };
    }

    // Update từng genre
    const updatePromises = updates.map((item) =>
      prisma.genre.update({
        where: { id: item.id },
        data: { name: item.newName },
      })
    );

    await Promise.all(updatePromises);

    return {
      message: `Successfully normalized ${updates.length} genre names`,
      updatedCount: updates.length,
      updates: updates.map((u) => ({ old: u.oldName, new: u.newName })),
      success: true,
    };
  } catch (error: any) {
    console.error("Error normalizing genre names:", error);
    throw new Error(`Failed to normalize genre names: ${error.message}`);
  }
};

const performFullGenreCleanup = async () => {
  try {
    console.log("🚀 Starting full genre cleanup...");

    const startTime = Date.now();

    // Step 1: Xóa invalid genres
    console.log("📍 Step 1: Removing invalid genres...");
    const invalidResult = await cleanupInvalidGenres();

    // Step 2: Merge duplicates
    console.log("📍 Step 2: Merging duplicate genres...");
    const duplicateResult = await cleanupDuplicateGenres();

    // Step 3: Xóa orphan genres (không có sách)
    console.log("📍 Step 3: Removing orphan genres (no books)...");
    const orphanResult = await cleanupOrphanGenres();

    // Step 4: Normalize names
    console.log("📍 Step 4: Normalizing genre names...");
    const normalizeResult = await normalizeGenreNames();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const totalDeleted =
      invalidResult.deletedGenresCount +
      duplicateResult.deletedGenresCount +
      orphanResult.deletedGenresCount;

    const summary = {
      success: true,
      executionTime: `${duration}s`,
      summary: {
        totalGenresDeleted: totalDeleted,
        invalidGenresDeleted: invalidResult.deletedGenresCount,
        duplicateGenresDeleted: duplicateResult.deletedGenresCount,
        orphanGenresDeleted: orphanResult.deletedGenresCount,
        genresNormalized: normalizeResult.updatedCount,
        totalRelationsDeleted:
          invalidResult.deletedRelationsCount +
          duplicateResult.deletedRelationsCount,
        totalRelationsMerged: duplicateResult.mergedRelationsCount || 0,
      },
      details: {
        step1_invalidGenres: {
          deleted: invalidResult.deletedGenresCount,
          relationsDeleted: invalidResult.deletedRelationsCount,
          examples: invalidResult.invalidGenreNames?.slice(0, 10) || [],
        },
        step2_duplicates: {
          deleted: duplicateResult.deletedGenresCount,
          merged: duplicateResult.mergedRelationsCount || 0,
          groups: duplicateResult.duplicateGroups,
          examples: duplicateResult.examples?.slice(0, 5) || [],
        },
        step3_orphanGenres: {
          deleted: orphanResult.deletedGenresCount,
          examples: orphanResult.orphanGenreNames?.slice(0, 10) || [],
        },
        step4_normalized: {
          updated: normalizeResult.updatedCount,
          examples: normalizeResult.updates?.slice(0, 10) || [],
        },
      },
      message: `✅ Full cleanup completed in ${duration}s: ${totalDeleted} genres deleted (${invalidResult.deletedGenresCount} invalid, ${duplicateResult.deletedGenresCount} duplicates, ${orphanResult.deletedGenresCount} orphans), ${normalizeResult.updatedCount} normalized`,
    };

    console.log(`✅ Cleanup completed successfully!`);
    console.log(`   - Invalid deleted: ${invalidResult.deletedGenresCount}`);
    console.log(
      `   - Duplicates deleted: ${duplicateResult.deletedGenresCount}`
    );
    console.log(`   - Orphans deleted: ${orphanResult.deletedGenresCount}`);
    console.log(`   - Normalized: ${normalizeResult.updatedCount}`);
    console.log(`   - Duration: ${duration}s`);

    return summary;
  } catch (error: any) {
    console.error("❌ Error performing full genre cleanup:", error);
    throw new Error(`Failed to perform full cleanup: ${error.message}`);
  }
};

export {
  getAllGenres,
  checkGenreNameExists,
  createGenre,
  updateGenre,
  deleteGenre as deleteGenreService,
  getGenresForDisplay,
  performFullGenreCleanup, // ⭐ API chính - chỉ cần export cái này
};
