import { Request, Response } from "express";
import {
  getAllPaymentsService,
  getPaymentByIdService,
  createPaymentForFine,
  payFine,
  updatePaymentStatusService,
  deletePaymentService,
  updateMembershipPaymentStatus,
} from "services/payment.service";
import { sendResponse } from "src/utils";

const getAllPayments = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllPaymentsService(currentPage);
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

const createPaymentFine = async (req: Request, res: Response) => {
  try {
    const { paymentRef, fineId } = req.body;
    const result = await createPaymentForFine(+fineId, paymentRef);
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

const paymentUpdateStatusForFine = async (req: Request, res: Response) => {
  try {
    const { paymentRef, paymentStatus, paymentType } = req.body;
    const result = await payFine(paymentRef, paymentStatus, paymentType);
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
const paymentUpdateStatusUserForMember = async (
  req: Request,
  res: Response
) => {
  try {
    const { paymentStatus, paymentRef, paymentType } = req.body;
    const result = await updateMembershipPaymentStatus(
      paymentStatus,
      paymentRef,
      paymentType
    );
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

const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return sendResponse(res, 400, "error", "Status is required", null);
    }

    const result = await updatePaymentStatusService(+id, status);
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

const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deletePaymentService(+id);
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

const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getPaymentByIdService(+id);
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

export {
  getAllPayments,
  paymentUpdateStatusForFine,
  paymentUpdateStatusUserForMember,
  createPaymentFine,
  updatePaymentStatus,
  deletePayment,
  getPaymentById,
};
