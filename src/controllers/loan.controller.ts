import { Request, Response } from "express";
import { prisma } from "configs/client";
import {
  createLoanService,
  getAllLoansService,
  getLoanById,
  getLoanReturnByIdService,
  renewalLoan,
  updateLoanService,
  deleteLoanService,
  approveReturnBook,
  processOverdueLoans,
} from "services/loan.service";
import { sendResponse } from "src/utils";

const getAllLoans = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getAllLoansService(+currentPage);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};
const createLoans = async (req: Request, res: Response) => {
  try {
    const { userId, bookId, dueDate } = req.body;
    const result = await createLoanService(+userId, +bookId, dueDate);
    return sendResponse(res, 201, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const renewalLoans = async (req: Request, res: Response) => {
  try {
    const { loanId, userId } = req.body;
    const result = await renewalLoan(+loanId, +userId);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const getOnLoanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getLoanById(+id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};
const getLoanReturnById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getLoanReturnByIdService(+id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const getCheckBookIsLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getLoanById(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const updateLoan = async (req: Request, res: Response) => {
  try {
    const { loanId, userId, dueDate, status } = req.body;
    const result = await updateLoanService(+loanId, +userId, dueDate, status);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const deleteLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteLoanService(+id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const returnBookApprove = async (req: Request, res: Response) => {
  try {
    const { loanId, userId } = req.body;
    const result = await approveReturnBook(+loanId, +userId);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const triggerOverdueCheck = async (req: Request, res: Response) => {
  try {
    console.log("👉 Manual trigger: Checking for overdue loans...");
    await processOverdueLoans();
    return sendResponse(
      res,
      200,
      "success",
      null
    );
  } catch (err: any) {
    return sendResponse(
      res,
      500,
      "error",
      "Error triggering overdue check: " + err.message,
      null
    );
  }
};

const seedOverdueLoan = async (req: Request, res: Response) => {
  try {
    const { userId, bookCopyId } = req.body;

    if (!userId || !bookCopyId) {
      return sendResponse(
        res,
        400,
        "error",
        "userId and bookCopyId are required",
        null
      );
    }

    // Create an overdue loan (due date was 5 days ago)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const loan = await prisma.loan.create({
      data: {
        userId: +userId,
        bookcopyId: +bookCopyId,
        loanDate: new Date(fiveDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000), // Loaned 12 days ago
        dueDate: fiveDaysAgo,
        status: "ON_LOAN",
      },
    });

    // Also update book copy status to ON_LOAN
    await prisma.bookcopy.update({
      where: { id: +bookCopyId },
      data: { status: "ON_LOAN" },
    });

    return sendResponse(
      res,
      201,
      "success",
      loan
    );
  } catch (err: any) {
    console.error(err);
    return sendResponse(
      res,
      500,
      "error",
      "Error creating seed data: " + err.message,
      null
    );
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
  triggerOverdueCheck,
  seedOverdueLoan,
};
