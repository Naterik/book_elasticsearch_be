import { Request, Response } from "express";
import { filterBooks } from "services/book/book.filter.service";
import {
  deleteBookService,
  getBooks,
  getBookByIdService,
  getMostBorrowedBooksService,
  getNewArrivalsService,
  getRecommendedBooksService,
  getTrendingBooksService,
  createBookService,
  updateBookService,
  getAllBooks,
  getBooksForSelectService,
} from "services/book/book.service";

import { Book, TBook } from "validation/books.schema";
import { fromError } from "zod-validation-error";
import { sendResponse } from "src/utils";

const getAllBookForSelect = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const result = await getBooksForSelectService(search as string);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message);
  }
};

const getAllBook = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getBooks(+currentPage);
    return sendResponse(res, 200, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message);
  }
};

const postBook = async (req: Request, res: Response) => {
  try {
    const {
      isbn,
      title,
      shortDesc,
      detailDesc,
      price,
      quantity,
      pages,
      publishDate,
      language,
      authorId,
      genreIds,
      publisherId,
    } = req.body;
    Book.omit({ id: true }).parse(req.body);
    const image = req?.file?.filename ?? null;
    const result = await createBookService(
      isbn,
      title,
      shortDesc,
      detailDesc,
      +price,
      +quantity,
      +pages,
      publishDate,
      language,
      +authorId,
      +publisherId,
      genreIds,
      image
    );
    return sendResponse(res, 201, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message);
  }
};

const putBook = async (req: Request, res: Response) => {
  try {
    const {
      id,
      isbn,
      title,
      shortDesc,
      detailDesc,
      price,
      quantity,
      pages,
      publishDate,
      language,
      authorId,
      genreIds,
      publisherId,
    } = req.body as TBook;
    if (Array.isArray(genreIds) && genreIds.length === 0)
      throw new Error("genreIds is required");
    Book.parse(req.body);
    const image = req?.file?.filename ?? null;

    const result = await updateBookService(
      +id,
      isbn,
      title,
      shortDesc,
      detailDesc,
      +price,
      +quantity,
      +pages,
      publishDate,
      language,
      +authorId,
      +publisherId,
      genreIds,
      image
    );
    return sendResponse(res, 201, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message);
  }
};

const deleteBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteBookService(+id);
    return sendResponse(res, 200, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message);
  }
};

const getBookById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getBookByIdService(+id);
    return sendResponse(res, 200, "success", result);
  } catch (e: any) {
    return sendResponse(res, 400, "error", e.message);
  }
};

const filterBook = async (req: Request, res: Response) => {
  try {
    const {
      page,
      genres,
      search = "",
      priceRange,
      order = "",
      yearRange,
      language,
    } = req.query as unknown as {
      page?: number;
      genres: string;
      search: string;
      priceRange: string[];
      order: string;
      yearRange: string[];
      language: string;
    };
    const result = await filterBooks(
      +page,
      priceRange,
      search,
      genres,
      order,
      yearRange,
      language
    );

    return sendResponse(res, 200, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message);
  }
};

const getMostBorrowedBooks = async (req: Request, res: Response) => {
  try {
    const result = await getMostBorrowedBooksService();
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};
const getRecommendedBooks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getRecommendedBooksService(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};
const getTrendingBooks = async (req: Request, res: Response) => {
  try {
    const result = await getTrendingBooksService();
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};
const getNewArrivals = async (req: Request, res: Response) => {
  try {
    const result = await getNewArrivalsService();
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

export {
  getAllBook,
  postBook,
  putBook,
  deleteBook,
  filterBook,
  getBookById,
  getMostBorrowedBooks,
  getRecommendedBooks,
  getTrendingBooks,
  getNewArrivals,
  getAllBookForSelect,
};

