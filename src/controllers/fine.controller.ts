import { Request, Response } from "express";
import {
  handleDeleteFined,
  handleGetAllFines,
  handleGetFinedById,
  handlePostFined,
  handlePutFined,
} from "services/fine.services";
import { Fine, TFine } from "validation/fine.schema";

import { fromError } from "zod-validation-error";

const getAllFined = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await handleGetAllFines(currentPage);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const getFinedById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleGetFinedById(+id);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ data: null, message: e.message });
  }
};

const postFined = async (req: Request, res: Response) => {
  try {
    const { amount, reason, isPaid, loanId, userId } = req.body as TFine;
    Fine.omit({ id: true }).parse(req.body);
    const result = await handlePostFined(
      +amount,
      reason,
      isPaid,
      +loanId,
      +userId
    );
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const putFined = async (req: Request, res: Response) => {
  try {
    const { id, amount, reason, isPaid, loanId, userId } = req.body as TFine;
    Fine.parse(req.body);
    const result = await handlePutFined(
      +id,
      +amount,
      reason,
      isPaid,
      +loanId,
      +userId
    );
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const deleteFined = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleDeleteFined(+id);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

export { getAllFined, getFinedById, postFined, putFined, deleteFined };
