import { prisma } from "configs/client";
import "dotenv/config";

const handleAllBookcopy = async () => {
  const result = await prisma.bookcopy.findMany({
    orderBy: { id: "desc" },
    include: { books: !0 },
  });
  return result;
};
const handleGetAllBookCopy = async (page: number) => {
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
const handlePostBookCopy = async (
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
const handlePutBookCopy = async (
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
const handleDeleteBookCopy = async (id: number) => {
  const result = await prisma.bookcopy.delete({
    where: { id },
  });
  return result;
};
export {
  handleGetAllBookCopy,
  handlePostBookCopy,
  handlePutBookCopy,
  handleDeleteBookCopy,
  handleAllBookcopy,
};
