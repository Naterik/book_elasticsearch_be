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
import { sendResponse } from "src/utils";

const getAllGenreDisplay = async (req: Request, res: Response) => {
  try {
    const data = await getGenresForDisplay();
    return sendResponse(res, 200, "success", data);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const getAllGenre = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllGenres(currentPage);

    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const postGenre = async (req: Request, res: Response) => {
  try {
    Genre.omit({ id: true }).parse(req.body);
    const { name, description } = req.body as TGenre;
    const result = await createGenre(name, description);
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

const putGenre = async (req: Request, res: Response) => {
  try {
    Genre.parse(req.body);
    const { id, name, description } = req.body as TGenre;
    const result = await updateGenre(id, name, description);
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

const deleteGenre = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteGenreService(id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const cleanupGenresController = async (req: Request, res: Response) => {
  try {
    console.log("📌 Genre cleanup API called");
    const result = await performFullGenreCleanup();
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    console.error("❌ Error in cleanup controller:", err);
    return sendResponse(res, 500, "error", err.message, null);
  }
};

export {
  getAllGenre,
  postGenre,
  putGenre,
  deleteGenre,
  getAllGenreDisplay,
  cleanupGenresController,
};
