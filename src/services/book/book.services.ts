import { prisma } from "configs/client";
import "dotenv/config";

const allBook = async () => {
  return await prisma.book.findMany({
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });
};
const handleGetAllBooks = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalBooks = await prisma.book.count();
  const totalPages = Math.ceil(countTotalBooks / +pageSize);
  const result = await prisma.book.findMany({
    skip,
    take: +pageSize,
    orderBy: { id: "desc" },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +pageSize,
      totalItems: countTotalBooks,
    },
  };
};

const handlePostBook = async (
  isbn: string,
  title: string,
  shortDesc: string,
  detailDesc: string,
  price: number,
  quantity: number,
  pages: number,
  publishDate: Date,
  language: string,
  authorId: number,
  publisherId: number,
  genreIds: string[] | string,
  image: string
) => {
  if (!Array.isArray(genreIds)) {
    genreIds = [genreIds];
  }
  const result = await prisma.book.create({
    data: {
      isbn,
      title,
      shortDesc,
      detailDesc,
      price,
      quantity,
      pages,
      publishDate: new Date(publishDate),
      language,
      authorId,
      publisherId,
      genres: {
        create: (genreIds as string[]).map((id) => ({
          genres: { connect: { id: +id } },
        })),
      },
      ...(image !== undefined && { image }),
    },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });
  return result;
};
const handlePutBook = async (
  id: number,
  isbn: string,
  title: string,
  shortDesc: string,
  detailDesc: string,
  price: number,
  quantity: number,
  pages: number,
  publishDate: Date,
  language: string,
  authorId: number,
  publisherId: number,
  genreIds: string[] | string,
  image: string
) => {
  if (!Array.isArray(genreIds)) {
    genreIds = [genreIds];
  }
  const result = await prisma.book.update({
    where: { id },
    data: {
      isbn,
      title,
      shortDesc,
      detailDesc,
      price,
      quantity,
      pages,
      publishDate: new Date(publishDate),
      language,
      authorId,
      publisherId,
      genres: {
        deleteMany: {},
        create: (genreIds as string[]).map((id) => ({
          genres: { connect: { id: +id } },
        })),
      },
      ...(image !== undefined && { image }),
    },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });
  return result;
};

const handleGetBookById = async (id: number) => {
  const result = prisma.book.findUnique({
    where: { id: +id },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });
  return result;
};

const handleDeleteBook = async (id: number) => {
  const deleteBookOnGenres = await prisma.booksOnGenres.deleteMany({
    where: { bookId: id },
  });
  if (!deleteBookOnGenres) throw new Error("Failed to delete related genres.");
  return await prisma.book.delete({ where: { id } });
};

const limitPerSection: number = +process.env.ITEM_PER_SECTION
  ? +process.env.ITEM_PER_SECTION
  : 10;
const handleGetMostBorrowedBooks = async () => {
  const limit = limitPerSection;
  const result = await prisma.book.findMany({
    orderBy: { borrowed: "desc" },
    take: limit,
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });
  if (!result) throw new Error("Most borrowed books not available !");
  return result;
};

const handleGetNewArrivals = async () => {
  const limit = limitPerSection;
  const result = await prisma.book.findMany({
    orderBy: { publishDate: "desc" },
    take: limit,
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });
  if (!result) throw new Error("Error fetching new arrivals !");
  return result;
};

const handleGetTrendingBooks = async () => {
  const limit = limitPerSection;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const trendingLoans = await prisma.loan.groupBy({
    by: ["bookcopyId"],
    where: {
      loanDate: {
        gte: thirtyDaysAgo,
      },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
    take: limit * 2,
  });
  const bookcopyIds = trendingLoans.map((loan) => loan.bookcopyId);

  const bookCopies = await prisma.bookcopy.findMany({
    where: {
      id: {
        in: bookcopyIds,
      },
    },
    select: {
      bookId: true,
    },
  });

  const bookIdCounts = bookCopies.reduce((acc, copy) => {
    acc[copy.bookId] = (acc[copy.bookId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const sortedBookIds = Object.entries(bookIdCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, limit)
    .map(([bookId]) => parseInt(bookId));
  const trendingBooks = await prisma.book.findMany({
    where: {
      id: {
        in: sortedBookIds,
      },
    },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });

  const orderedBooks = sortedBookIds
    .map((id) => trendingBooks.find((book) => book.id === id))
    .filter(Boolean);
  return orderedBooks;
};

const handleGetRecommendedBooks = async (userId: number) => {
  const limit = limitPerSection;
  const userLoans = await prisma.loan.findMany({
    where: {
      userId: userId,
    },
    include: {
      bookCopy: {
        include: {
          books: {
            include: {
              genres: {
                include: {
                  genres: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      loanDate: "desc",
    },
    take: 10,
  });
  const genreMap = new Map<number, number>();
  const borrowedBookIds = new Set<number>();

  userLoans.forEach((loan) => {
    const book = loan.bookCopy.books;
    borrowedBookIds.add(book.id);

    book.genres.forEach((genreBook) => {
      const genreId = genreBook.genres.id;
      genreMap.set(genreId, (genreMap.get(genreId) || 0) + 1);
    });
  });

  const topGenres = Array.from(genreMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genreId]) => genreId);

  if (topGenres.length === 0) {
    return handleGetTrendingBooks();
  }
  const recommendedBooks = await prisma.book.findMany({
    where: {
      AND: [
        {
          id: {
            notIn: Array.from(borrowedBookIds),
          },
        },
        {
          genres: {
            some: {
              genreId: {
                in: topGenres,
              },
            },
          },
        },
        {
          quantity: {
            gt: 0,
          },
        },
      ],
    },
    orderBy: [
      {
        borrowed: "desc",
      },
      {
        publishDate: "desc",
      },
    ],
    take: limit,
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
    },
  });

  return recommendedBooks;
};
export {
  handleGetAllBooks,
  handlePostBook,
  handlePutBook,
  handleDeleteBook,
  allBook,
  handleGetBookById,
  handleGetMostBorrowedBooks,
  handleGetNewArrivals,
  handleGetRecommendedBooks,
  handleGetTrendingBooks,
};
