import { Request, Response } from "express";
import "dotenv/config";
import {
  cleanupOldNotifications,
  getNotifications,
  getUnreadNotifications,
  updateAllNotifications,
  updateSingleNotification,
} from "services/notification.realtime.service";
import { sendResponse } from "src/utils";

const getNotificationsByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await getNotifications(+userId);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const getUnread = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await getUnreadNotifications(+userId);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const putSingleNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { id } = req.body;
    const result = await updateSingleNotification(+id, +userId);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const putBulkNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await updateAllNotifications(+userId);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const cleanupNotifications = async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.body;
    const result = await cleanupOldNotifications(days);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

export {
  getNotificationsByUserId,
  getUnread as getUnreadNotifications,
  putSingleNotification,
  putBulkNotification,
  cleanupNotifications,
};

