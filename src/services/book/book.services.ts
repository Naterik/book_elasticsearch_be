import { prisma } from "configs/client";
import "dotenv/config";
import { handleCreateFine } from "services/fine.services";

import {
  handleCheckLoanExist,
  handleUpdateStatus,
} from "services/loan.services";
import { handleCheckMemberCard } from "services/member.services";

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
  return prisma.$transaction(async (tx) => {
    const updateStatusLoan = await handleUpdateStatus(loanId, userId);
    const isFined =
      updateStatusLoan?.status === "LOST" ||
      updateStatusLoan?.status === "OVERDUE";
    if (isFined) {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: isFined ? "INACTIVE" : "SUSPENDED",
        },
      });
      await handleCreateFine(updateStatusLoan.id);
    }

    const book = await tx.book.update({
      where: {
        id: loan.bookCopy.books.id,
        borrowed: {
          gt: 0,
        },
      },
      data: {
        borrowed: { decrement: 1 },
      },
    });
    await tx.bookcopy.update({
      where: { id: loan.bookCopy.id },
      data: {
        status: isFined ? "AVAILABLE" : "LOST",
        heldByUserId: null,
      },
    });
    const returnSuccess = await tx.notification.create({
      data: {
        userId: loan.userId,
        type: !isFined ? "SUCCESS_RETURNED" : "FINE_CREATED",
        content: !isFined
          ? "You have successfully returned the book."
          : `You have been fined with the "${loan.bookCopy.books.title}" for ${updateStatusLoan.status} `,
        sentAt: new Date(),
      },
    });
    return {
      book,
      returnSuccess,
    };
  });
};
export {
  handleGetAllBooks,
  handlePostBook,
  handlePutBook,
  handleDeleteBook,
  allBook,
  handleGetBookById,
  handleReturnBook,
};
