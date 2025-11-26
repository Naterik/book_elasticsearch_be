import { prisma } from "configs/client";
import { checkMemberCard } from "./member.service";

const createReservation = async (bookId: number, userId: number) => {
  const { user } = await checkMemberCard(userId);
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

const getAllReservations = async (currentPage: number) => {
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

const getReservationById = async (id: number) => {
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
const handleGetReservationByUserId = async (id: number) => {
  const reservation = await prisma.reservation.findMany({
    where: { userId: id },
    include: {
      book: {
        omit: { shortDesc: true, detailDesc: true },
        include: { authors: { select: { name: true } } },
      },
    },
  });
  return reservation;
};

const updateReservationStatus = async (id: number, status: string) => {
  const updatedReservation = await prisma.reservation.update({
    where: { id },
    data: {
      status,
    },
  });
  return updatedReservation;
};
//user
const cancelReservationStatus = async (id: number) => {
  const updatedReservation = await prisma.reservation.update({
    where: { id },
    data: {
      status: "CANCELED",
    },
  });
  return updatedReservation;
};

const deleteReservation = async (id: number) => {
  const deletedReservation = await prisma.reservation.delete({
    where: { id },
  });
  return deletedReservation;
};

export {
  getAllReservations as getAllReservationsService,
  getReservationById as getReservationByIdService,
  createReservation as createReservationService,
  updateReservationStatus,
  deleteReservation as deleteReservationService,
  handleGetReservationByUserId as getReservationsByUserId,
  cancelReservationStatus,
};
