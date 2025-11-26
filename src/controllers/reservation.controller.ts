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
const createReservation = async (req: Request, res: Response) => {
  try {
    const { bookId, userId } = req.body;
    const result = await createReservationService(+bookId, +userId);
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

const getAllReservations = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;
    const result = await getAllReservationsService(currentPage);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message, data: null });
  }
};

const getReservationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getReservationByIdService(+id);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ message: "Reservation not found", data: null });
  }
};
const getReservationByUserId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getReservationsByUserId(+id);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ message: "Reservation not found", data: null });
  }
};

const putCancelReservationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await cancelReservationStatus(+id);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message, data: null });
  }
};

const updateReservation = async (req: Request, res: Response) => {
  try {
    const { status, id } = req.body;

    const result = await updateReservationStatus(+id, status);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message, data: null });
  }
};

const deleteReservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteReservationService(+id);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message, data: null });
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
