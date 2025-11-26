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

const getAllAuthor = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllAuthors(currentPage);

    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const postAuthor = async (req: Request, res: Response) => {
  try {
    const { name, bio } = req.body as TAuthor;
    Author.omit({ id: true }).parse(req.body);
    const result = await createAuthor(name, bio);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const putAuthor = async (req: Request, res: Response) => {
  try {
    Author.parse(req.body);
    const { id, name, bio } = req.body as TAuthor;
    const result = await updateAuthor(id, name, bio);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const deleteAuthor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteAuthorService(id);
    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const postManyAuthors = async (req: Request, res: Response) => {
  try {
    Author.array().parse(req.body);
    const authors = req.body as { name: string; bio?: string }[];
    if (!Array.isArray(authors)) throw new Error("Invalid authors data");
    const result = await createMultipleAuthors(authors);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

export { getAllAuthor, postAuthor, putAuthor, deleteAuthor, postManyAuthors };
