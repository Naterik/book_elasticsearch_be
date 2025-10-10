import { Request, Response } from "express";
import { fromError } from "zod-validation-error";
import {
  handleDeleteGenre,
  handleGetAllGenre,
  handleGetAllGenreDisplay,
  handlePostGenre,
  handlePutGenre,
  handleTotalPagesGenre,
} from "services/book/genre.services";
import { Genre, TGenre } from "validation/genre.schema";

const getAllGenreDisplay = async (req: Request, res: Response) => {
  try {
    const data = await handleGetAllGenreDisplay();
    res.status(200).json({ data });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const getAllGenre = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: any = page ? page : 1;
    if (+currentPage <= 0) currentPage = 1;

    const result = await handleGetAllGenre(+currentPage);
    const totalPage = await handleTotalPagesGenre();

    res.status(200).json({ data: result, totalPage });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const postGenre = async (req: Request, res: Response) => {
  try {
    Genre.omit({ id: true }).parse(req.body);
    const { name, description } = req.body as TGenre;
    const result = await handlePostGenre(name, description);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const putGenre = async (req: Request, res: Response) => {
  try {
    Genre.parse(req.body);
    const { id, name, description } = req.body as TGenre;
    const result = await handlePutGenre(id, name, description);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const deleteGenre = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleDeleteGenre(id);
    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

export { getAllGenre, postGenre, putGenre, deleteGenre, getAllGenreDisplay };
