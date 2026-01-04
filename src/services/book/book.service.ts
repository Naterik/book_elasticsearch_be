import { prisma } from "configs/client";
import { client } from "configs/elastic";
import "dotenv/config";

const getAllBooks = async () => {
  return await prisma.book.findMany({
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });
};
const getBooks = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 12;
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
      digitalBook: { select: { status: true } },
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

const indexBook = process.env.INDEX_N_GRAM_BOOK;
const createBookService = async (
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
        create: genreIds.map((id) => ({
          genres: { connect: { id: +id } },
        })),
      },
      ...(image !== undefined && { image }),
    },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });
  if (result && indexBook) {
    await client.index({
      index: indexBook,
      document: {
        id: result.id,
        isbn: result.isbn,
        title: result.title,
        shortDesc: result.shortDesc,
        detailDesc: result.detailDesc,
        price: result.price,
        quantity: result.quantity,
        pages: result.pages,
        publishDate: result.publishDate,
        language: result.language,
        authorId: result.authorId,
        publisherId: result.publisherId,
        image: result.image,
        genres: result.genres.map((g) => ({
          genres: {
            id: g.genres.id,
            name: g.genres.name,
          },
        })),
        authors: {
          name: result.authors.name,
        },
        publishers: {
          name: result.publishers.name,
        },
        suggest: [result.title, result.authors.name].filter((item) => item),
      },
      refresh: true,
    });
  }
  return result;
};
const updateBookService = async (
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
      digitalBook: { select: { status: true } },
    },
  });

  if (result && indexBook) {
    await client.index({
      index: indexBook,
      id: String(result.id),
      document: {
        id: result.id,
        isbn: result.isbn,
        title: result.title,
        shortDesc: result.shortDesc,
        detailDesc: result.detailDesc,
        price: result.price,
        quantity: result.quantity,
        pages: result.pages,
        publishDate: result.publishDate,
        language: result.language,
        authorId: result.authorId,
        publisherId: result.publisherId,
        image: result.image,
        genres: result.genres.map((g) => ({
          genres: {
            id: g.genres.id,
            name: g.genres.name,
          },
        })),
        authors: {
          name: result.authors.name,
        },
        publishers: {
          name: result.publishers.name,
        },
        suggest: [result.title, result.authors.name].filter((item) => item),
      },
      refresh: true,
    });
  }
  return result;
};

const getBookByIdService = async (id: number) => {
  const result = prisma.book.findUnique({
    where: { id: +id },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });
  return result;
};

const deleteBookService = async (id: number) => {
  const deleteBookOnGenres = await prisma.booksOnGenres.deleteMany({
    where: { bookId: id },
  });
  if (!deleteBookOnGenres) throw new Error("Failed to delete related genres.");
  const result = await prisma.book.delete({ where: { id } });

  if (indexBook) {
    try {
      await client.delete({
        index: indexBook,
        id: String(id),
        refresh: true,
      });
    } catch (error) {
      console.error(`Failed to delete book ${id} from elasticsearch`, error);
    }
  }
  return result;
};

const limitPerSection: number = +process.env.ITEM_PER_SECTION
  ? +process.env.ITEM_PER_SECTION
  : 10;
const getMostBorrowedBooksService = async () => {
  const result = await prisma.book.findMany({
    orderBy: { borrowed: "desc" },
    take: limitPerSection,
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });
  if (!result) throw new Error("Most borrowed books not available !");
  return result;
};

const getNewArrivalsService = async () => {
  const result = await prisma.book.findMany({
    orderBy: { publishDate: "desc" },
    take: limitPerSection,
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });
  if (!result) throw new Error("Error fetching new arrivals !");
  return result;
};

const getTrendingBooksService = async () => {
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
    take: limitPerSection * 2,
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
    .slice(0, limitPerSection)
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
      digitalBook: { select: { status: true } },
    },
  });

  const orderedBooks = sortedBookIds
    .map((id) => trendingBooks.find((book) => book.id === id))
    .filter(Boolean);
  return orderedBooks;
};

const getRecommendedBooksService = async (userId: number) => {
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
    take: limitPerSection,
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
    return getTrendingBooksService();
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
    take: limitPerSection,
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });

  return recommendedBooks;
};

const getBooksForSelectService = async (search: string = "") => {
  if (search !== "") {
    return await prisma.book.findMany({
      where: {
        OR: [{ title: { contains: search } }, { isbn: { contains: search } }],
      },
      take: 50,
      select: {
        id: true,
        title: true,
        isbn: true,
        image: true,
        authors: { select: { name: true } },
      },
    });
  } else {
    return await prisma.book.findMany({
      take: 50,
      select: {
        id: true,
        title: true,
        isbn: true,
        image: true,
        authors: { select: { name: true } },
      },
      orderBy: { id: "desc" },
    });
  }
};

const getBooksBatch = async (skip: number, take: number) => {
  return await prisma.book.findMany({
    skip,
    take,
    orderBy: { id: "desc" },
    include: {
      authors: { select: { name: true } },
      genres: { select: { genres: { select: { id: true, name: true } } } },
      publishers: { select: { name: true } },
      digitalBook: { select: { status: true } },
    },
  });
};

const countBooks = async () => {
  return await prisma.book.count();
};

export {
  getBooks,
  createBookService,
  updateBookService,
  deleteBookService,
  getAllBooks,
  getBooksBatch,
  countBooks,
  getBookByIdService,
  getMostBorrowedBooksService,
  getNewArrivalsService,
  getRecommendedBooksService,
  getTrendingBooksService,
  getBooksForSelectService,
};
