import { prisma } from "configs/client";
import "dotenv/config";
const handleGetAllBookCopy = async (page: number) => {
  const pageSize = +process.env.PAGE_SIZE || 10;
  const skip = (page - 1) * pageSize;
  const countTotalItems = await prisma.bookcopy.count();
  const totalPages = Math.ceil(countTotalItems / pageSize);
  const bookCopy = await prisma.bookcopy.findMany({
    skip,
    take: pageSize,
    orderBy: { id: "desc" },
    include: { books: true },
  });
  return {
    bookCopy,
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
  const newCopy = await prisma.bookcopy.create({
    data: {
      year_published,
      copyNumber,
      bookId,
      status,
      location,
    },
    include: { books: true },
  });
  return newCopy;
};
const handlePutBookCopy = async (
  id: number,
  year_published: number,
  copyNumber: string,
  bookId: number,
  status: string,
  location: string
) => {
  const updatedCopy = await prisma.bookcopy.update({
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
  return updatedCopy;
};
const handleDeleteBookCopy = async (id: number) => {
  const deletedCopy = await prisma.bookcopy.delete({
    where: { id },
  });
  return deletedCopy;
};
export {
  handleGetAllBookCopy,
  handlePostBookCopy,
  handlePutBookCopy,
  handleDeleteBookCopy,
};
