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
    const result = await tx.reservation.create({
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
    return result;
  });
};

const handleGetAllReservations = async (currentPage: number) => {
  const limit = +process.env.ITEM_PER_PAGE;
  const offset = (currentPage - 1) * limit;

  const result = await prisma.reservation.findMany({
    skip: offset,
    take: limit,
    include: {
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
      book: {
        omit: { shortDesc: true, detailDesc: true },
        include: { authors: { select: { name: true } } },
      },
    },
    orderBy: {
      requestDate: "desc",
    },
  });

  const totalReservations = await prisma.reservation.count();
  const totalPages = Math.ceil(totalReservations / limit);

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +limit,
      totalItems: totalReservations,
    },
  };
};

const handleGetReservationById = async (id: number) => {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id },
    include: {
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
      book: {
        omit: { shortDesc: true, detailDesc: true },
        include: { authors: { select: { name: true } } },
      },
    },
  });
  return reservation;
};

const handleUpdateReservationStatus = async (id: number, status: string) => {
  const updatedReservation = await prisma.reservation.update({
    where: { id },
    data: {
      status,
    },
  });
  return updatedReservation;
};

const handleDeleteReservation = async (id: number) => {
  const deletedReservation = await prisma.reservation.delete({
    where: { id },
  });
  return deletedReservation;
};

export {
  handleGetAllReservations,
  handleGetReservationById,
  handleCreateReservation,
  handleUpdateReservationStatus,
  handleDeleteReservation,
};
