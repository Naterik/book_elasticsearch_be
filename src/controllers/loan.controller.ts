import { Request, Response } from "express";
import {
  createLoanService,
  getAllLoansService,
  getLoanById,
  getLoanReturnByIdService,
  renewalLoan,
  updateLoanService,
  deleteLoanService,
  approveReturnBook,
} from "services/loan.service";

const getAllLoans = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getAllLoansService(+currentPage);
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
    const { userId, bookId, dueDate } = req.body;
    const result = await createLoanService(+userId, +bookId, dueDate);
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
    const result = await renewalLoan(+loanId, +userId);
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

const getOnLoanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getLoanById(+id);
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
const getLoanReturnById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getLoanReturnByIdService(+id);
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

const getCheckBookIsLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getLoanById(+id);
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

const updateLoan = async (req: Request, res: Response) => {
  try {
    const { loanId, userId, dueDate, status } = req.body;
    const result = await updateLoanService(+loanId, +userId, dueDate, status);
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

const deleteLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteLoanService(+id);
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

const returnBookApprove = async (req: Request, res: Response) => {
  try {
    const { loanId, userId } = req.body;
    const result = await approveReturnBook(+loanId, +userId);
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

export {
  createLoans,
  renewalLoans,
  getAllLoans,
  getOnLoanById,
  getLoanReturnById,
  getCheckBookIsLoan,
  updateLoan,
  deleteLoan,
  returnBookApprove,
};
