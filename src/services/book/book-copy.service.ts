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
  const pageSize = +process.env.PAGE_SIZE || 10;
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
  status: string,
  location: string
) => {
  const result = await prisma.bookcopy.create({
    data: {
      year_published,
      copyNumber,
      bookId,
      status,
      location,
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
  status: string,
  location: string
) => {
  const result = await prisma.bookcopy.update({
    where: { id },
    data: {
      year_published,
      copyNumber,
      bookId,
      status,
      location,
    },
    include: { books: true },
  });
  return result;
};
const deleteBookCopy = async (id: number) => {
  const result = await prisma.bookcopy.delete({
    where: { id },
  });
  return result;
};
export {
  getBookCopies,
  createBookCopy,
  updateBookCopy,
  deleteBookCopy as deleteBookCopyService,
  getAllBookCopies,
};
