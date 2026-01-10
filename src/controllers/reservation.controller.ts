import { Request, Response } from "express";
import {
  cancelReservationStatus,
  createReservationService,
  deleteReservationService,
  getAllReservationsService,
  getReservationByIdService,
  getReservationsByUserId,
  updateReservationStatus,
} from "services/reservation.service";
import { sendResponse } from "src/utils";

const createReservation = async (req: Request, res: Response) => {
  try {
    const { bookId, userId } = req.body;
    const result = await createReservationService(+bookId, +userId);
    return sendResponse(
      res,
      201,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

const getAllReservations = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getAllReservationsService(currentPage);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 500, "error", error.message);
  }
};

const getReservationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getReservationByIdService(+id);
    return sendResponse(res, 200, "success", result);
  } catch (e: any) {
    return sendResponse(res, 404, "error", "Reservation not found");
  }
};
const getReservationByUserId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getReservationsByUserId(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 404, "error", "Reservation not found");
  }
};

const putCancelReservationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await cancelReservationStatus(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
  }
};

const updateReservation = async (req: Request, res: Response) => {
  try {
    const { status, id } = req.body;

    const result = await updateReservationStatus(+id, status);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
  }
};

const deleteReservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteReservationService(+id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (error: any) {
    return sendResponse(res, 400, "error", error.message);
  }
};

export {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation,
  getReservationByUserId,
  putCancelReservationStatus,
};

