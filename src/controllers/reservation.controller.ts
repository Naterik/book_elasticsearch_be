import { Request, Response } from "express";
import { handleCreateReservation } from "services/reservation.services";
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

export { createReservation };
