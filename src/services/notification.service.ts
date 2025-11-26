import { prisma } from "configs/client";

const getNotifications = async (userId: number) => {
  const notification = await prisma.notification.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
  });
  return notification;
};

const updateSingleNotification = async (id: number, userId: number) => {
  const notification = await prisma.notification.update({
    where: { id, userId, isRead: false },
    data: { isRead: true },
  });
  return notification;
};

const updateAllNotifications = async (userId: number) => {
  const notification = await prisma.notification.updateMany({
    where: { userId },
    data: { isRead: true },
  });
  return notification;
};
export { getNotifications, updateSingleNotification, updateAllNotifications };
