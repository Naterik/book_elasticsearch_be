import { prisma } from "configs/client";

const handleGetNotifications = async (userId: number) => {
  const notification = await prisma.notification.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
  });
  return notification;
};

const handlePutSingleNotification = async (id: number, userId: number) => {
  const notification = await prisma.notification.update({
    where: { id, userId, isRead: false },
    data: { isRead: true },
  });
  return notification;
};

const handlePutBulkNotification = async (userId: number) => {
  const notification = await prisma.notification.updateMany({
    where: { userId },
    data: { isRead: true },
  });
  return notification;
};
export {
  handleGetNotifications,
  handlePutSingleNotification,
  handlePutBulkNotification,
};
