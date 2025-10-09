import { Request, Response } from "express";
import { handleFilterBook } from "services/book/book.filter.services";
import {
  handleDeleteBook,
  handleGetAllBooks,
  handleGetBookById,
  handlePostBook,
  handlePutBook,
  handleReturnBook,
} from "services/book/book.services";

import { Book, TBook } from "validation/books.schema";
import { fromError } from "zod-validation-error";

const getAllBook = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await handleGetAllBooks(+currentPage);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
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
    } = req.body as TBook;
    Book.omit({ id: true }).parse(req.body);
    const image = req?.file?.filename ?? null;
    const result = await handlePostBook(
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
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
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

    const result = await handlePutBook(
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
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const deleteBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleDeleteBook(+id);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const getBookById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleGetBookById(+id);
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    res.status(400).json({
      data: null,
      message: e.message,
    });
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
    const result = await handleFilterBook(
      +page,
      priceRange,
      search,
      genres,
      order,
      yearRange,
      language
    );

    res.status(200).json({
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const returnBook = async (req: Request, res: Response) => {
  try {
    const { loanId, userId } = req.body;
    const result = await handleReturnBook(+loanId, +userId);
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

export {
  getAllBook,
  postBook,
  putBook,
  deleteBook,
  filterBook,
  getBookById,
  returnBook,
};
