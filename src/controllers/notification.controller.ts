import { Request, Response } from "express";
import "dotenv/config";
import {
  cleanupOldNotifications,
  handleGetNotifications,
  handleGetUnreadNotifications,
  handlePutBulkNotification,
  handlePutSingleNotification,
} from "services/notification.realtime.services";

const getNotificationsByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await handleGetNotifications(+userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const getUnreadNotifications = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await handleGetUnreadNotifications(+userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const putSingleNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { id } = req.body;
    const result = await handlePutSingleNotification(+id, +userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const putBulkNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await handlePutBulkNotification(+userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const cleanupNotifications = async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.body;
    const result = await cleanupOldNotifications(days);
    res.status(200).json({ data: result, message: "Cleanup completed" });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

export {
  getNotificationsByUserId,
  getUnreadNotifications,
  putSingleNotification,
  putBulkNotification,
  cleanupNotifications,
};
