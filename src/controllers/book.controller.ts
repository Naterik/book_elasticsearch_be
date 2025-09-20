import { Request, Response } from "express";
import {
  handleDeleteBook,
  handleGetAllBooks,
  handlePostBook,
  handlePutBook,
} from "services/book.services";
import { Book, TBook } from "validation/books.schema";
import { fromError } from "zod-validation-error";

const getAllBook = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const books = await handleGetAllBooks(+currentPage);
    res.status(200).json({ data: books });
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
    const book = await handlePostBook(
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
    res.status(201).json({ data: book });
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

    const book = await handlePutBook(
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
    res.status(201).json({ data: book });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const deleteBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const book = await handleDeleteBook(+id);
    res.status(200).json({ data: book });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

export { getAllBook, postBook, putBook, deleteBook };
