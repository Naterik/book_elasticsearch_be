import { Request, Response } from "express";
import "dotenv/config";
import {
  cleanupOldNotifications,
  getNotifications,
  getUnreadNotifications,
  updateAllNotifications,
  updateSingleNotification,
} from "services/notification.realtime.service";

const getNotificationsByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await getNotifications(+userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const getUnread = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await getUnreadNotifications(+userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const putSingleNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { id } = req.body;
    const result = await updateSingleNotification(+id, +userId);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(400).json({ message: e.message, data: null });
  }
};

const putBulkNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await updateAllNotifications(+userId);
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
  getUnread as getUnreadNotifications,
  putSingleNotification,
  putBulkNotification,
  cleanupNotifications,
};
