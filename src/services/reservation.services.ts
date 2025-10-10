import { prisma } from "configs/client";
import { handleCheckMemberCard } from "./member.services";

const handleCreateReservation = async (bookId: number, userId: number) => {
  const { user } = await handleCheckMemberCard(userId);
  if (!user.cardNumber)
    throw new Error("User doesn't have permission to renewal !");
  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({
      where: {
        id: bookId,
      },
    });
    const checkValidReservation = book.quantity - book.borrowed;
    if (checkValidReservation !== 0)
      throw new Error("Book cannot reservation !");
    const reservation = await tx.reservation.create({
      data: {
        userId,
        bookId,
        status: "PENDING",
        requestDate: new Date(),
      },
    });
    const notification = await tx.notification.create({
      data: {
        userId,
        type: "RESERVATION_CREATED",
        content: `You have success reserve "${book.title}".`,
        sentAt: new Date(),
      },
    });
    return {
      reservation,
      notification,
    };
  });
};
export { handleCreateReservation };
