import { Request, Response } from "express";
import {
  handleCreatePaymentForFine,
  handlePayFine,
  handlePaymentUpdateStatus,
} from "services/payment.services";

const createPaymentFine = async (req: Request, res: Response) => {
  try {
    const { paymentRef, fineId } = req.body;
    const result = await handleCreatePaymentForFine(+fineId, paymentRef);
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

const paymentUpdateStatusForFine = async (req: Request, res: Response) => {
  try {
    const { paymentRef, paymentStatus } = req.body;
    const result = await handlePayFine(paymentRef, paymentStatus);
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
const paymentUpdateStatusUser = async (req: Request, res: Response) => {
  try {
    const { paymentStatus, paymentRef } = req.body;
    const result = await handlePaymentUpdateStatus(paymentStatus, paymentRef);
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
  paymentUpdateStatusForFine,
  paymentUpdateStatusUser,
  createPaymentFine,
};
