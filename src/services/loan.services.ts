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

const handleCreateLoan = async (userId: number, bookcopyId: number) => {
  const { user, policy } = await handleCheckMemberCard(userId);
  const now = new Date();
  const due = new Date();
  due.setDate(due.getDate() + policy.loanDays);

  return prisma.$transaction(async (tx) => {
    const activeLoans = await tx.loan.count({
      where: { userId, status: { in: ["ON_LOAN", "OVERDUE"] } },
    });
    if (activeLoans > policy.maxActiveLoans)
      throw new Error(`Maximum ${policy.maxActiveLoans} books allowed`);

    const copy = await tx.bookcopy.findUnique({
      where: { id: bookcopyId },
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
      const ok = await tx.bookcopy.updateMany({
        where: { id: copy.id, status: "AVAILABLE" },
        data: { status: "ON_LOAN" },
      });
      if (ok.count !== 1) throw new Error("Copy just taken, try again");
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
      where: { id: copy.bookId },
      data: { borrowed: { increment: 1 } },
    });

    if (user.cardNumber) {
      const r = await tx.reservation.findFirst({
        where: { userId, bookId: copy.bookId, status: "NOTIFIED" },
      });
      if (r) {
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: "COMPLETED" },
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

    return { loan, notification };
  });
};

const handleRenewalLoans = async (loanId: number, userId: number) => {
  const { user } = await handleCheckMemberCard(userId);
  if (!user.cardNumber)
    throw new Error("User doesn't have permission to renewal !");
  return prisma.$transaction(async (tx) => {
    const checkLoan = await tx.loan.findFirst({
      where: { id: loanId },
      include: {
        bookCopy: { include: { books: { select: { title: true } } } },
      },
    });
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

    const renewal = await tx.loan.update({
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
    return { renewal, notification };
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

  const updateStatusLoan = await prisma.loan.update({
    where: { id: loanId },
    data: {
      status,
      returnDate,
    },
  });

  return updateStatusLoan;
};

export {
  handleGetAllLoans,
  handleCreateLoan,
  handleRenewalLoans,
  handleUpdateStatus,
  handleCheckLoanExist,
};
