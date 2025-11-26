import { Request, Response } from "express";
import {
  deleteFine,
  getAllFines,
  getFinesByUserId,
  createFine,
  updateFine,
} from "services/fine.service";
import { Fine, TFine } from "validation/fine.schema";
import { fromError } from "zod-validation-error";

const getAllFined = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getAllFines(currentPage);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const getFinedByUserId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getFinesByUserId(+id);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ data: null, message: e.message });
  }
};

const postFined = async (req: Request, res: Response) => {
  try {
    const { amount, reason, isPaid, loanId, userId } = req.body as TFine;
    Fine.omit({ id: true }).parse(req.body);
    const result = await createFine(+amount, reason, isPaid, +loanId, +userId);
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

const putFined = async (req: Request, res: Response) => {
  try {
    const { id, amount, reason, isPaid, loanId, userId } = req.body as TFine;
    Fine.parse(req.body);
    const result = await updateFine(
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
    const result = await deleteFine(+id);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: fromError(error).toString(), data: null });
  }
};

export { getAllFined, getFinedByUserId, postFined, putFined, deleteFined };
