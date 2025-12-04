import { Request, Response } from "express";
import { fromError } from "zod-validation-error";
import {
  deleteGenreService,
  getAllGenres,
  getGenresForDisplay,
  createGenre,
  updateGenre,
  performFullGenreCleanup,
} from "services/book/genre.service";
import { Genre, TGenre } from "validation/genre.schema";

const getAllGenreDisplay = async (req: Request, res: Response) => {
  try {
    const data = await getGenresForDisplay();
    res.status(200).json({ data });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const getAllGenre = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllGenres(currentPage);

    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const postGenre = async (req: Request, res: Response) => {
  try {
    Genre.omit({ id: true }).parse(req.body);
    const { name, description } = req.body as TGenre;
    const result = await createGenre(name, description);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const putGenre = async (req: Request, res: Response) => {
  try {
    Genre.parse(req.body);
    const { id, name, description } = req.body as TGenre;
    const result = await updateGenre(id, name, description);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const deleteGenre = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteGenreService(id);
    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const cleanupGenresController = async (req: Request, res: Response) => {
  try {
    console.log("📌 Genre cleanup API called");
    const result = await performFullGenreCleanup();
    res.status(200).json({ data: result });
  } catch (err: any) {
    console.error("❌ Error in cleanup controller:", err);
    res.status(500).json({ message: err.message, data: null });
  }
};

export {
  getAllGenre,
  postGenre,
  putGenre,
  deleteGenre,
  getAllGenreDisplay,
  cleanupGenresController, // ⭐ API duy nhất để cleanup
};
