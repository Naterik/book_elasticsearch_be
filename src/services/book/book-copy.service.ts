import { prisma } from "configs/client";
import "dotenv/config";

const getAllBookCopies = async () => {
  const result = await prisma.bookcopy.findMany({
    orderBy: { id: "desc" },
    include: { books: !0 },
  });
  return result;
};
const getBookCopies = async (page: number) => {
  const pageSize = +process.env.ITEM_PER_PAGE || 12;
  const skip = (page - 1) * pageSize;
  const countTotalItems = await prisma.bookcopy.count();
  const totalPages = Math.ceil(countTotalItems / pageSize);
  const result = await prisma.bookcopy.findMany({
    skip,
    take: pageSize,
    orderBy: { id: "desc" },
    include: { books: true },
  });
  return {
    result,
    pagination: {
      currentPage: page,
      totalPages,
      pageSize: +pageSize,
      totalItems: countTotalItems,
    },
  };
};
const createBookCopy = async (
  year_published: number,
  copyNumber: string,
  bookId: number,
  status: string
) => {
  const result = await prisma.bookcopy.create({
    data: {
      year_published,
      copyNumber,
      bookId,
      status,
    },
    include: { books: true },
  });
  return result;
};
const updateBookCopy = async (
  id: number,
  year_published: number,
  copyNumber: string,
  bookId: number,
  status: string
) => {
  const result = await prisma.bookcopy.update({
    where: { id },
    data: {
      year_published,
      copyNumber,
      bookId,
      status,
    },
    include: { books: true },
  });
  return result;
};
const deleteBookCopyService = async (id: number) => {
  const result = await prisma.bookcopy.delete({
    where: { id },
  });
  return result;
};

const getBookCopyStatusById = async (bookId: number) => {
  const bookcopy = await prisma.bookcopy.findFirst({
    where: { bookId: bookId, status: "AVAILABLE" },
  });
  return bookcopy;
};

const generateCopiesForBookService = async (bookId: number) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new Error("Book not found");
  }

  const year = book.publishDate
    ? new Date(book.publishDate).getFullYear()
    : new Date().getFullYear();
  const copies = [];

  const existingCount = await prisma.bookcopy.count({
    where: { bookId: bookId },
  });

  for (let i = 0; i < 3; i++) {
    const copyNumIndex = existingCount + i + 1;
    const copyNumber = `CP-${book.id}-${copyNumIndex}`;

    const copy = await prisma.bookcopy.create({
      data: {
        year_published: year,
        copyNumber: copyNumber,
        bookId: book.id,
        status: "AVAILABLE",
      },
    });
    copies.push(copy);
  }

  await prisma.book.update({
    where: { id: bookId },
    data: { quantity: { increment: 3 } },
  });

  return copies;
};

const generateCopiesForAllBooksService = async () => {
  const books = await prisma.book.findMany({ select: { id: true } });
  let totalCopies = 0;

  for (const b of books) {
    await generateCopiesForBookService(b.id);
    totalCopies += 3;
  }
  return {
    message: `Generated 3 copies for ${books.length} books. Total ${totalCopies} copies.`,
  };
};

export {
  getBookCopies,
  createBookCopy,
  updateBookCopy,
  deleteBookCopyService,
  getAllBookCopies,
  getBookCopyStatusById,
  generateCopiesForBookService,
  generateCopiesForAllBooksService,
};
