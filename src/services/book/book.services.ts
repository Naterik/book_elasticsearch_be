import { prisma } from "configs/client";
import "dotenv/config";

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
  const newBookCopyStatus = newLoanStatus === "LOST" ? "LOST" : "AVAILABLE";
  return prisma.$transaction(async (tx) => {
    await tx.loan.update({
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

    return result;
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
