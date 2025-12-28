import { Request, Response } from "express";
import {
  getAllBookCopies,
  deleteBookCopyService,
  getBookCopies,
  createBookCopy,
  updateBookCopy,
  getBookCopyStatusById,
  generateCopiesForAllBooksService,
} from "services/book/book-copy.service";
import { BookCopy } from "validation/book-copy.schema";
import { fromError } from "zod-validation-error";

const getAllBookCopy = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getBookCopies(+page);
    res.status(200).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message, data: null });
  }
};
const postBookCopy = async (req: Request, res: Response) => {
  try {
    const { year_published, copyNumber, bookId, status } = req.body;
    BookCopy.omit({ id: true }).parse(req.body);
    const result = await createBookCopy(
      +year_published,
      copyNumber,
      +bookId,
      status,

    );
    res.status(201).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: fromError(error).toString(), data: null });
  }
};

const putBookCopy = async (req: Request, res: Response) => {
  try {
    const { id, year_published, copyNumber, bookId, status } =
      req.body;
    BookCopy.parse(req.body);
    const result = await updateBookCopy(
      +id,
      +year_published,
      copyNumber,
      +bookId,
      status,
      
    );
    res.status(200).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: fromError(error).toString(), data: null });
  }
};
const generateCopiesAll = async (req: Request, res: Response) => {
  try {
    const result = await generateCopiesForAllBooksService();
    res.status(201).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message || "Error", data: null });
  }
};

const deleteBookCopy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteBookCopyService(+id);
    res.status(200).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message, data: null });
  }
};

const getBookCopyStatusByBookId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getBookCopyStatusById(+id);
    if (result === null) {
      return res.status(200).json({ data: { status: "UNAVAILABLE" } });
    }
    res.status(200).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message, data: null });
  }
};
export {
  getAllBookCopy,
  postBookCopy,
  putBookCopy,
  deleteBookCopy,
  getBookCopyStatusByBookId,
  generateCopiesAll,
};
