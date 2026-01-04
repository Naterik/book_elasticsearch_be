import { Request, Response } from "express";
import { fromError } from "zod-validation-error";
import {
  createMultipleAuthors,
  deleteAuthorService,
  getAllAuthors,
  createAuthor,
  updateAuthor,
} from "services/book/author.service";
import { Author, TAuthor } from "validation/author.schema";
import { sendResponse } from "src/utils";

const getAllAuthor = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllAuthors(currentPage);

    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const postAuthor = async (req: Request, res: Response) => {
  try {
    const { name, bio } = req.body as TAuthor;
    Author.omit({ id: true }).parse(req.body);
    const result = await createAuthor(name, bio);
    return sendResponse(res, 201, "success", result);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message,
      null
    );
  }
};

const putAuthor = async (req: Request, res: Response) => {
  try {
    Author.parse(req.body);
    const { id, name, bio } = req.body as TAuthor;
    const result = await updateAuthor(id, name, bio);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message,
      null
    );
  }
};

const deleteAuthor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteAuthorService(id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const postManyAuthors = async (req: Request, res: Response) => {
  try {
    Author.array().parse(req.body);
    const authors = req.body as { name: string; bio?: string }[];
    if (!Array.isArray(authors)) throw new Error("Invalid authors data");
    const result = await createMultipleAuthors(authors);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message,
      null
    );
  }
};

export { getAllAuthor, postAuthor, putAuthor, deleteAuthor, postManyAuthors };
