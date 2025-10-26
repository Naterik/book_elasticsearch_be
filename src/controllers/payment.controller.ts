import { Request, Response } from "express";
import {
  handleGetAllPayments,
  handleGetPaymentById,
  handleCreatePaymentForFine,
  handlePayFine,
  handleUpdatePaymentStatus,
  handleDeletePayment,
  handlePaymentUpdateStatusMember,
} from "services/payment.services";

const getAllPayments = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await handleGetAllPayments(currentPage);
    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

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
    const { paymentRef, paymentStatus, paymentType } = req.body;
    const result = await handlePayFine(paymentRef, paymentStatus, paymentType);
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
const paymentUpdateStatusUserForMember = async (
  req: Request,
  res: Response
) => {
  try {
    const { paymentStatus, paymentRef, paymentType } = req.body;
    const result = await handlePaymentUpdateStatusMember(
      paymentStatus,
      paymentRef,
      paymentType
    );
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

const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        message: "Status is required",
        data: null,
      });
    }

    const result = await handleUpdatePaymentStatus(+id, status);
    res.status(200).json({
      data: result,
      message: "Payment status updated successfully",
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleDeletePayment(+id);
    res.status(200).json({
      data: result,
      message: "Payment deleted successfully",
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleGetPaymentById(+id);
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
  getAllPayments,
  paymentUpdateStatusForFine,
  paymentUpdateStatusUserForMember,
  createPaymentFine,
  updatePaymentStatus,
  deletePayment,
  getPaymentById,
};
