import { prisma } from "configs/client";
import { client } from "configs/elastic";
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

const indexBookCopy = process.env.INDEX_BOOKCOPY;
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
    include: {
      books: {
        include: {
          authors: true,
        },
      },
    },
  });

  if (result) {
    await client.index({
      index: indexBookCopy,
      document: {
        id: result.id,
        year_published: result.year_published,
        copyNumber: result.copyNumber,
        bookId: result.bookId,
        status: result.status,
        isbn: result.books.isbn,
        books: {
          id: result.books.id,
          title: result.books.title,
          isbn: result.books.isbn,
          shortDesc: result.books.shortDesc,
          detailDesc: result.books.detailDesc,
          price: result.books.price,
          quantity: result.books.quantity,
          borrowed: result.books.borrowed,
          pages: result.books.pages,
          publishDate: result.books.publishDate,
          language: result.books.language,
          image: result.books.image,
          authorId: result.books.authorId,
          publisherId: result.books.publisherId,
        },
        author: result.books.authors.name,
      },
      refresh: true,
    });
  }
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
    include: {
      books: {
        include: {
          authors: true,
        },
      },
    },
  });

  if (result) {
    await client.index({
      index: indexBookCopy,
      id: String(id),
      document: {
        id: result.id,
        year_published: result.year_published,
        copyNumber: result.copyNumber,
        bookId: result.bookId,
        status: result.status,
        isbn: result.books.isbn,
        books: {
          id: result.books.id,
          title: result.books.title,
          isbn: result.books.isbn,
          shortDesc: result.books.shortDesc,
          detailDesc: result.books.detailDesc,
          price: result.books.price,
          quantity: result.books.quantity,
          borrowed: result.books.borrowed,
          pages: result.books.pages,
          publishDate: result.books.publishDate,
          language: result.books.language,
          image: result.books.image,
          authorId: result.books.authorId,
          publisherId: result.books.publisherId,
        },
        author: result.books.authors.name,
      },
      refresh: true,
    });
  }
  return result;
};
const deleteBookCopyService = async (id: number) => {
  const result = await prisma.bookcopy.delete({
    where: { id },
  });

  if (result) {
    try {
      await client.delete({
        index: indexBookCopy,
        id: String(id),
        refresh: true,
      });
    } catch (error) {
      console.error(
        `Failed to delete book copy ${id} from elasticsearch`,
        error
      );
    }
  }
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
    include: { authors: true },
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

    if (indexBookCopy) {
      await client.index({
        index: indexBookCopy,
        document: {
          id: copy.id,
          year_published: copy.year_published,
          copyNumber: copy.copyNumber,
          bookId: copy.bookId,
          status: copy.status,
          isbn: book.isbn,
          books: {
            id: book.id,
            title: book.title,
            isbn: book.isbn,
            shortDesc: book.shortDesc,
            detailDesc: book.detailDesc,
            price: book.price,
            quantity: book.quantity,
            borrowed: book.borrowed,
            pages: book.pages,
            publishDate: book.publishDate,
            language: book.language,
            image: book.image,
            authorId: book.authorId,
            publisherId: book.publisherId,
          },
          author: book.authors.name,
        },
        refresh: true,
      });
    }
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

const getBookCopiesBatch = async (skip: number, take: number) => {
  return await prisma.bookcopy.findMany({
    skip,
    take,
    orderBy: { id: "desc" },
    include: { books: true },
  });
};

const countBookCopies = async () => {
  return await prisma.bookcopy.count();
};
export {
  getBookCopies,
  createBookCopy,
  updateBookCopy,
  deleteBookCopyService,
  getAllBookCopies,
  getBookCopiesBatch,
  countBookCopies,
  getBookCopyStatusById,
  generateCopiesForBookService,
  generateCopiesForAllBooksService,
};
