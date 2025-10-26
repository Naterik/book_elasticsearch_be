import { prisma } from "configs/client";
import "dotenv/config";

import {
  handleCheckLoanExist,
  handleUpdateStatus,
} from "services/loan.services";

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

const handleReturnBook = async (loanId: number, userId: number) => {
  const loan = await handleCheckLoanExist(loanId);

  const returnDate = new Date(); //
  const daysLate = Math.ceil(
    (returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  // const late = Math.ceil(
  //   (returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  // );
  // const daysLate = Math.max(1, late);
  // console.log("daysLate :>> ", daysLate);
  let newLoanStatus: "RETURNED" | "OVERDUE" | "LOST";
  if (daysLate <= 0) {
    newLoanStatus = "RETURNED";
  } else if (daysLate > 0 && daysLate <= 30) {
    newLoanStatus = "OVERDUE";
  } else {
    newLoanStatus = "LOST";
  }

  let fineData = null;
  if (!(newLoanStatus === "RETURNED")) {
    let fineAmount = 0;
    if (newLoanStatus === "LOST") {
      fineAmount = loan.bookCopy.books.price;
    } else if (newLoanStatus === "OVERDUE") {
      fineAmount = Math.max(1, daysLate) * 10000;
    }
    fineData = {
      amount: fineAmount,
      reason: newLoanStatus,
      loanId: loan.id,
      userId: loan.userId,
    };
  }
  let newBookCopyStatus = newLoanStatus === "LOST" ? "LOST" : "AVAILABLE";
  return prisma.$transaction(async (tx) => {
    const loanUpdate = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: newLoanStatus,
        returnDate: returnDate,
      },
    });
    const result = await tx.book.update({
      where: { id: loan.bookCopy.books.id },
      data: {
        borrowed: { decrement: 1 },
      },
    });
    let heldForUser = null;
    let holdExpires: Date | null = null;

    if (newLoanStatus !== "LOST") {
      const nextReservation = await tx.reservation.findFirst({
        where: {
          bookId: loan.bookCopy.bookId,
          status: "PENDING",
        },
        orderBy: {
          requestDate: "asc",
        },
      });

      if (nextReservation) {
        newBookCopyStatus = "ON_HOLD";
        heldForUser = nextReservation.userId;
        holdExpires = new Date();
        holdExpires.setDate(holdExpires.getDate() + 3);

        await tx.reservation.update({
          where: { id: nextReservation.id },
          data: { status: "NOTIFIED" },
        });

        await tx.notification.create({
          data: {
            userId: nextReservation.userId,
            type: "RESERVATION_READY",
            content: `This book "${
              loan.bookCopy.books.title
            }" is now available. Please pick it up before ${holdExpires.toLocaleDateString(
              "vi-VN"
            )}.`,
            sentAt: new Date(),
          },
        });
      }
    }

    await tx.bookcopy.update({
      where: { id: loan.bookCopy.id },
      data: {
        status: newBookCopyStatus,
        heldByUserId: null,
      },
    });

    if (fineData) {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: newLoanStatus === "OVERDUE" ? "INACTIVE" : "SUSPENDED",
        },
      });

      await tx.fine.create({
        data: fineData,
      });
    }
    const notificationContent = !fineData
      ? "You have successfully returned the book."
      : `You have been fined with the "${loan.bookCopy.books.title}" for ${newLoanStatus} `;

    const notification = await tx.notification.create({
      data: {
        userId: loan.userId,
        type: !fineData ? "SUCCESS_RETURNED" : "FINE_CREATED",
        content: notificationContent,
        sentAt: new Date(),
      },
    });

    return loanUpdate;
  });
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
    .sort(([, a], [, b]) => b - a)
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
  handleReturnBook,
  handleGetMostBorrowedBooks,
  handleGetNewArrivals,
  handleGetRecommendedBooks,
  handleGetTrendingBooks,
};
