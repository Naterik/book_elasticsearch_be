import { Request, Response } from "express";
import { fromError } from "zod-validation-error";
import {
  handleDeleteAuthor,
  handleGetAllAuthor,
  handlePostAuthor,
  handlePutAuthor,
  handleTotalPagesAuthor,
} from "services/author.service";
import { Author, TAuthor } from "validation/author.schema";

const getAllAuthor = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: any = page ? page : 1;
    if (+currentPage <= 0) currentPage = 1;

    const data = await handleGetAllAuthor(+currentPage);
    const totalPage = await handleTotalPagesAuthor();

    res.status(200).json({ data, totalPage });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const postAuthor = async (req: Request, res: Response) => {
  try {
    const { name, bio } = req.body as TAuthor;
    Author.omit({ id: true }).parse(req.body);
    const author = await handlePostAuthor(name, bio);
    res.status(200).json({ data: author });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const putAuthor = async (req: Request, res: Response) => {
  try {
    Author.parse(req.body);
    const { id, name, bio } = req.body as TAuthor;
    const author = await handlePutAuthor(id, name, bio);
    res.status(200).json({ data: author });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const deleteAuthor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const author = await handleDeleteAuthor(id);
    res.status(200).json({ data: author });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

export { getAllAuthor, postAuthor, putAuthor, deleteAuthor };
