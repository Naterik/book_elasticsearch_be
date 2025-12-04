import { prisma } from "configs/client";
import { getWebSocketManager } from "configs/websocket";
import { INotificationPayload } from "src/types";

export const addNotificationRealtime = async (
  payload: INotificationPayload
): Promise<any> => {
  try {
    // 1. Lưu vào database
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        priority: payload.priority || "NORMAL",
      },
    });

    // 2. Phát realtime tới client (nếu online)
    const wsManager = getWebSocketManager();
    wsManager.sendNotificationToUser(payload.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      priority: notification.priority,
      sentAt: notification.sentAt,
    });

    // 3. Update unread count
    const unreadCount = await prisma.notification.count({
      where: { userId: payload.userId, isRead: false },
    });
    wsManager.sendUnreadCountUpdate(payload.userId, unreadCount);

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Tạo thông báo cho nhiều users
 * Ví dụ: Thông báo sách trở về có sẵn cho tất cả users đã reserve
 */
export const addNotificationForMultipleUsers = async (
  userIds: number[],
  payload: Omit<INotificationPayload, "userId">
): Promise<any> => {
  try {
    // Tạo thông báo cho tất cả users
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        priority: payload.priority || "NORMAL",
      })),
      skipDuplicates: true,
    });

    // Phát realtime
    const wsManager = getWebSocketManager();
    const notificationData = {
      type: payload.type,
      title: payload.title,
      content: payload.content,
      priority: payload.priority || "NORMAL",
      sentAt: new Date(),
    };

    userIds.forEach(async (userId) => {
      wsManager.sendNotificationToUser(userId, {
        ...notificationData,
        id: 0, // Sẽ được update khi query
      });

      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });
      wsManager.sendUnreadCountUpdate(userId, unreadCount);
    });

    return notifications;
  } catch (error) {
    console.error("Error creating notifications for multiple users:", error);
    throw error;
  }
};

/**
 * Lấy tất cả thông báo của user
 */
export const getNotifications = async (userId: number) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: 50,
  });
  return notifications;
};

/**
 * Lấy thông báo chưa đọc
 */
export const getUnreadNotifications = async (userId: number) => {
  const notifications = await prisma.notification.findMany({
    where: { userId, isRead: false },
    orderBy: [{ priority: "asc" }, { sentAt: "desc" }],
  });
  return notifications;
};

/**
 * Đánh dấu thông báo đơn lẻ đã đọc
 */
export const updateSingleNotification = async (id: number, userId: number) => {
  const notification = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  // Update unread count realtime
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  const wsManager = getWebSocketManager();
  wsManager.sendUnreadCountUpdate(userId, unreadCount);

  return notification;
};

/**
 * Đánh dấu tất cả thông báo đã đọc
 */
export const updateAllNotifications = async (userId: number) => {
  const result = await prisma.notification.updateMany({
    where: { userId },
    data: { isRead: true },
  });

  // Update unread count realtime
  const wsManager = getWebSocketManager();
  wsManager.sendUnreadCountUpdate(userId, 0);

  return result;
};

/**
 * Xóa thông báo cũ (cleanup)
 * Xóa thông báo đã đọc sau 30 ngày
 */
export const cleanupOldNotifications = async (daysOld: number = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      sentAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`🧹 Cleaned up ${result.count} old notifications`);
  return result;
};
