import { Request, Response } from "express";

import "dotenv/config";
import {
  handleGetNotifications,
  handlePutBulkNotification,
  handlePutSingleNotification,
} from "services/notification.services";

const getNotificationsByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await handleGetNotifications(+userId);
    res.status(200).json({ data: result });
  } catch (e) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const putSingleNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { id } = req.body;
    const result = await handlePutSingleNotification(+id, +userId);
    res.status(200).json({ data: result });
  } catch (e) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const putBulkNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await handlePutBulkNotification(+userId);
    res.status(200).json({ data: result });
  } catch (e) {
    res.status(400).json({ message: e.message, data: null });
  }
};
export { getNotificationsByUserId, putSingleNotification, putBulkNotification };
