import { Request, Response } from "express";
import {
  handleCreateLoan,
  handleGetAllLoans,
  handleRenewalLoans,
} from "services/loan.services";

const getAllLoans = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await handleGetAllLoans(+currentPage);
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};
const createLoans = async (req: Request, res: Response) => {
  try {
    const { userId, bookcopyId } = req.body;
    const result = await handleCreateLoan(+userId, +bookcopyId);
    res.status(201).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const renewalLoans = async (req: Request, res: Response) => {
  try {
    const { loanId, userId } = req.body;
    const result = await handleRenewalLoans(+loanId, +userId);
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

export { createLoans, renewalLoans, getAllLoans };
