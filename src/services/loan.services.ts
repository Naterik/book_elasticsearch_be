import { prisma } from "configs/client";
import { handleCheckMemberCard } from "./member.services";
import "dotenv/config";

const handleGetAllLoans = async (currentPage: number) => {
  const pageSize = +process.env.ITEM_PER_PAGE;
  const skip = (currentPage - 1) * pageSize;
  const total = await prisma.loan.count({});
  const totalPages = Math.ceil(total / pageSize);
  const result = await prisma.loan.findMany({
    skip,
    take: +pageSize,
    include: {
      bookCopy: { include: { books: { select: { title: true } } } },
      user: true,
    },
  });
  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +pageSize,
      totalItems: total,
    },
  };
};

const handleCreateLoan = async (
  userId: number,
  bookId: number,
  dueDate: string
) => {
  const { user, policy } = await handleCheckMemberCard(userId);
  const now = new Date();
  const due =
    dueDate === "7"
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const activeLoans = await tx.loan.count({
      where: { userId, status: { in: ["ON_LOAN", "OVERDUE"] } },
    });
    if (activeLoans > policy.maxActiveLoans)
      throw new Error(`Maximum ${policy.maxActiveLoans} books allowed`);

    const copy = await tx.bookcopy.findFirst({
      where: { bookId, status: "AVAILABLE" },
      include: { books: true },
    });

    if (copy.status === "ON_HOLD") {
      if (
        copy.heldByUserId !== userId ||
        !copy.holdExpiryDate ||
        copy.holdExpiryDate <= now
      ) {
        throw new Error("This copy is on hold for another user");
      }

      const updateLoan = await tx.bookcopy.updateMany({
        where: {
          id: copy.id,
          status: "ON_HOLD",
          heldByUserId: userId,
          holdExpiryDate: { gt: now },
        },
        data: { status: "ON_LOAN", heldByUserId: null, holdExpiryDate: null },
      });
      if (updateLoan.count !== 1) throw new Error("Hold expired or copy taken");
    } else if (copy.status === "AVAILABLE") {
      const r = await tx.bookcopy.updateMany({
        where: { id: copy.id, status: "AVAILABLE" },
        data: { status: "ON_LOAN" },
      });
      if (r.count !== 1) throw new Error("Copy just taken, try again");
    } else {
      throw new Error(`Bookcopy is ${copy.status}`);
    }

    const loan = await tx.loan.create({
      data: {
        userId,
        bookcopyId: copy.id,
        loanDate: now,
        dueDate: due,
        status: "ON_LOAN",
      },
    });

    await tx.book.update({
      where: { id: bookId },
      data: { borrowed: { increment: 1 } },
    });

    if (user.cardNumber) {
      const r = await tx.reservation.findFirst({
        where: { userId, bookId: bookId, status: "PENDING" },
      });
      if (r) {
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: "NOTIFIED" },
        });
      }
    }
    const notification = await tx.notification.create({
      data: {
        userId,
        type: "LOAN_CREATED",
        content: `You have loaned "${
          copy.books.title
        }". Due date: ${due.toLocaleDateString("vi-VN")}${
          loan?.dueDate ? "" : " (Register member card to get 14 days!)"
        }`,
        sentAt: new Date(),
      },
    });

    return loan;
  });
};

const handleCheckBookIsLoan = async (userId: number) => {
  const loan = await prisma.loan.findFirst({
    where: { userId, status: "ON_LOAN" },
    include: {
      bookCopy: {
        include: {
          books: {
            omit: { shortDesc: true, detailDesc: true },
            include: { authors: { select: { name: true } } },
          },
        },
      },
    },
  });
  return !!loan;
};

const handleRenewalLoans = async (loanId: number, userId: number) => {
  const { user } = await handleCheckMemberCard(userId);
  if (!user.cardNumber)
    throw new Error("User doesn't have permission to renewal !");
  return prisma.$transaction(async (tx) => {
    const checkLoan = await tx.loan.findFirst({
      where: { id: loanId, status: "ON_LOAN" },
      include: {
        bookCopy: { include: { books: { select: { title: true } } } },
      },
    });
    if (!checkLoan) throw new Error("User doesn't have any loan book");
    const pendingReservations = await tx.reservation.count({
      where: {
        bookId: checkLoan.bookCopy.bookId,
        status: { in: ["PENDING", "NOTIFIED"] },
        userId: { not: userId },
      },
    });

    if (pendingReservations > 0) {
      throw new Error("Cannot renew. Other users are waiting for this book.");
    }
    if (checkLoan.renewalCount >= 2) throw new Error("Max renewal time");

    let newDueDate = checkLoan.dueDate;
    newDueDate.setDate(newDueDate.getDate() + 7);

    const result = await tx.loan.update({
      where: { id: loanId },
      data: {
        dueDate: newDueDate,
        renewalCount: { increment: 1 },
      },
    });
    const notification = await tx.notification.create({
      data: {
        userId,
        type: "LOAN_RENEWED",
        content: `Renewal term "${
          checkLoan.bookCopy.books.title
        }" has been last to ${newDueDate.toLocaleDateString("vi-VN")}`,
        sentAt: new Date(),
      },
    });
    return result;
  });
};

const handleCheckLoanExist = async (loanId: number) => {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId },
    include: { bookCopy: { include: { books: true } } },
  });
  if (!loan) throw new Error("Loan not exist !");
  return loan;
};

const handleUpdateStatus = async (loanId: number, userId: number) => {
  const { policy } = await handleCheckMemberCard(userId);
  const returnDate = new Date();
  const loan = await handleCheckLoanExist(loanId);
  const daysLate = Math.ceil(
    (returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  let status = "";
  if (daysLate < policy.maxActiveLoans) {
    status = "OVERDUE";
  } else if (daysLate > 30) {
    status = "LOST";
  } else {
    status = "RETURNED";
  }

  const result = await prisma.loan.update({
    where: { id: loanId },
    data: {
      status,
      returnDate,
    },
  });

  return result;
};

const handleGetLoanById = async (id: number) => {
  const result = await prisma.loan.findMany({
    where: { userId: id, status: "ON_LOAN" },
    include: {
      bookCopy: {
        include: {
          books: {
            omit: { shortDesc: true, detailDesc: true },
            include: { authors: { select: { name: true } } },
          },
        },
      },
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
    },
  });
  return result;
};

const handleGetLoanReturnById = async (id: number) => {
  const result = await prisma.loan.findMany({
    where: { userId: id, status: "RETURNED" },
    include: {
      bookCopy: {
        include: {
          books: {
            omit: { shortDesc: true, detailDesc: true },
            include: { authors: { select: { name: true } } },
          },
        },
      },
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
    },
  });
  return result;
};

const handleUpdateLoan = async (
  loanId: number,
  userId: number,
  dueDate?: Date,
  status?: string
) => {
  const loan = await handleCheckLoanExist(loanId);

  if (loan.userId !== userId) {
    throw new Error("You don't have permission to update this loan");
  }

  const updateData: any = {};

  if (dueDate) {
    updateData.dueDate = new Date(dueDate);
  }

  if (status && ["ON_LOAN", "RETURNED", "OVERDUE", "LOST"].includes(status)) {
    updateData.status = status;
  }

  const result = await prisma.loan.update({
    where: { id: loanId },
    data: updateData,
    include: {
      bookCopy: {
        include: {
          books: {
            include: { authors: { select: { name: true } } },
          },
        },
      },
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
    },
  });

  return result;
};

const handleDeleteLoan = async (loanId: number, userId: number) => {
  const loan = await handleCheckLoanExist(loanId);

  if (loan.userId !== userId) {
    throw new Error("You don't have permission to delete this loan");
  }
  if (loan.status === "ON_LOAN") {
    throw new Error(
      "Cannot delete an active loan. Please return the book first."
    );
  }

  return prisma.$transaction(async (tx) => {
    const fines = await tx.fine.findMany({
      where: { loanId: loanId },
    });

    if (fines.length > 0 && fines.some((f) => f.isPaid === false)) {
      throw new Error("Cannot delete loan with unpaid fines");
    }
    const result = await tx.loan.delete({
      where: { id: loanId },
    });

    return result;
  });
};

export {
  handleGetAllLoans,
  handleCreateLoan,
  handleRenewalLoans,
  handleUpdateStatus,
  handleCheckLoanExist,
  handleGetLoanById,
  handleGetLoanReturnById,
  handleCheckBookIsLoan,
  handleUpdateLoan,
  handleDeleteLoan,
};
