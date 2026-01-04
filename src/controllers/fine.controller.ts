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
import { sendResponse } from "src/utils";

const getAllFined = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getAllFines(currentPage);
    return sendResponse(res, 200, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message,
      null
    );
  }
};

const getFinedByUserId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getFinesByUserId(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 404, "error", e.message, null);
  }
};

const postFined = async (req: Request, res: Response) => {
  try {
    const { amount, reason, isPaid, loanId, userId } = req.body as TFine;
    Fine.omit({ id: true }).parse(req.body);
    const result = await createFine(+amount, reason, isPaid, +loanId, +userId);
    return sendResponse(res, 201, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message,
      null
    );
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
    return sendResponse(res, 201, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message,
      null
    );
  }
};

const deleteFined = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteFine(+id);
    return sendResponse(res, 200, "success", result);
  } catch (error: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(error).toString() || error.message,
      null
    );
  }
};

export { getAllFined, getFinedByUserId, postFined, putFined, deleteFined };
