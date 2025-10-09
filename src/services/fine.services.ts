import { prisma } from "configs/client";

const handleCreateFine = async (loanId: number, userId: number) => {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: { id: loanId, status: { in: ["OVERDUE", "LOST"] } },
      include: {
        bookCopy: {
          include: {
            books: { select: { title: true, id: true, price: true } },
          },
        },
      },
    });
    let fineAmount = 0;
    let fineReason = "";
    if (loan.status === "LOST") {
      fineAmount = loan.bookCopy.books.price;
      fineReason = "LOST";
    } else if (loan.dueDate && loan.returnDate > loan.dueDate) {
      const daysLate = Math.ceil(
        (loan.returnDate.getTime() - loan.dueDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      fineAmount = daysLate * 10000;
      fineReason = "OVERDUE";
    }
    const fine = await tx.fine.create({
      data: {
        amount: fineAmount,
        reason: fineReason,
        loanId,
        userId,
      },
    });
    return fine;
  });
};

export { handleCreateFine };
