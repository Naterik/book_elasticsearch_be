import { Request, Response } from "express";
import {
  handleCancelReservationStatus,
  handleCreateReservation,
  handleDeleteReservation,
  handleGetAllReservations,
  handleGetReservationById,
  handleGetReservationByUserId,
  handleUpdateReservationStatus,
} from "services/reservation.services";
const createReservation = async (req: Request, res: Response) => {
  try {
    const { bookId, userId } = req.body;
    const result = await handleCreateReservation(+bookId, +userId);
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
    const result = await handleGetAllReservations(currentPage);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message, data: null });
  }
};

const getReservationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleGetReservationById(+id);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ message: "Reservation not found", data: null });
  }
};
const getReservationByUserId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleGetReservationByUserId(+id);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ message: "Reservation not found", data: null });
  }
};

const putCancelReservationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await handleCancelReservationStatus(+id);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message, data: null });
  }
};

const updateReservation = async (req: Request, res: Response) => {
  try {
    const { status, id } = req.body;

    const result = await handleUpdateReservationStatus(+id, status);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message, data: null });
  }
};

const deleteReservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleDeleteReservation(+id);
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
