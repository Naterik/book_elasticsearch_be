import { Request, Response } from "express";
import {
  handlePayFine,
  handlePaymentUpdateStatus,
} from "services/payment.services";

const paymentFine = async (req: Request, res: Response) => {
  try {
    const { paymentRef, userId, fineId } = req.body;
    const result = await handlePayFine(+userId, +fineId, paymentRef);
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

export { paymentFine, paymentUpdateStatusUser };
