import { prisma } from "configs/client";
import { checkMemberCard } from "./member.service";

const createReservationService = async (bookId: number, userId: number) => {
  const { user } = await checkMemberCard(userId);
  if (!user.cardNumber) {
    throw new Error(
      "User does not have a valid membership card to reserve books!"
    );
  }
  return prisma.$transaction(async (tx) => {
    // 2. Kiểm tra xem user có đang mượn hoặc đã đặt cuốn này chưa
    const existingLoanOrRes = await tx.loan.findFirst({
      where: {
        userId,
        bookcopyId: {
          in: (
            await tx.bookcopy.findMany({
              where: { bookId },
              select: { id: true },
            })
          ).map((b) => b.id),
        },
        status: "ON_LOAN",
      },
    });

    if (existingLoanOrRes)
      throw new Error("You are already holding a copy of this book.");

    const existingPendingRes = await tx.reservation.findFirst({
      where: { userId, bookId, status: { in: ["PENDING", "NOTIFIED"] } },
    });
    if (existingPendingRes)
      throw new Error("You already have a pending reservation for this book.");

    // Đếm số bản copy đang AVAILABLE
    const availableCopiesCount = await tx.bookcopy.count({
      where: {
        bookId: bookId,
        status: "AVAILABLE",
      },
    });

    // 4. Nếu còn sách AVAILABLE -> Không cho Reserve -> Bắt buộc ra mượn
    if (availableCopiesCount > 0) {
      throw new Error(
        "Book is currently available on the shelf. Please borrow it directly instead of reserving."
      );
    }

    // 5. Nếu không còn sách -> Tạo Reservation
    const newReservation = await tx.reservation.create({
      data: {
        userId,
        bookId,
        status: "PENDING",
        requestDate: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "RESERVATION_CREATED",
        content: `You have successfully reserved book ID ${bookId}. You are in the queue.`,
        sentAt: new Date(),
      },
    });

    return newReservation;
  });
};

const getAllReservationsService = async (currentPage: number) => {
  const limit = +process.env.ITEM_PER_PAGE;
  const offset = (currentPage - 1) * limit;

  const result = await prisma.reservation.findMany({
    skip: offset,
    take: limit,
    include: {
      user: {
        omit: {
          password: true,
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

const getReservationByIdService = async (id: number) => {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id },
    include: {
      user: {
        omit: {
          password: true,
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
const getReservationsByUserId = async (id: number) => {
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

const deleteReservationService = async (id: number) => {
  const deletedReservation = await prisma.reservation.delete({
    where: { id },
  });
  return deletedReservation;
};

export {
  getAllReservationsService,
  getReservationByIdService,
  createReservationService,
  updateReservationStatus,
  deleteReservationService,
  getReservationsByUserId,
  cancelReservationStatus,
};
