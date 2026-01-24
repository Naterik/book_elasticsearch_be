import { Request, Response } from "express";
import {
  getAllBookCopies,
  deleteBookCopyService,
  getBookCopies,
  createBookCopy,
  updateBookCopy,
  getBookCopyStatusById,
  generateCopiesForAllBooksService,
  getBookCopiesByBookId,
} from "services/book/book-copy.service";
import { BookCopy } from "validation/book-copy.schema";
import { fromError } from "zod-validation-error";
import { sendResponse } from "src/utils";



const getAllBookCopy = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getBookCopies(+page);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
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
      status
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

const putBookCopy = async (req: Request, res: Response) => {
  try {
    const { id, year_published, copyNumber, bookId, status } = req.body;
    BookCopy.parse(req.body);
    const result = await updateBookCopy(
      +id,
      +year_published,
      copyNumber,
      +bookId,
      status
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
const generateCopiesAll = async (req: Request, res: Response) => {
  try {
    const result = await generateCopiesForAllBooksService();
    return sendResponse(
      res,
      201,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message || "Error");
  }
};

const deleteBookCopy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteBookCopyService(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
  }
};

const getBookCopyStatusByBookId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getBookCopyStatusById(+id);
    if (result === null) {
      return sendResponse(
        res,
        200,
        "success",
        { status: "UNAVAILABLE" }
      );
    }
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
  }
};

const getCopiesByBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getBookCopiesByBookId(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
  }
};
export {
  getAllBookCopy,
  postBookCopy,
  putBookCopy,
  deleteBookCopy,
  getBookCopyStatusByBookId,
  generateCopiesAll,
  getCopiesByBook,
};

