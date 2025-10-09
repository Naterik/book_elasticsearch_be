import { prisma } from "configs/client";
import { handleCheckLoanExist } from "./loan.services";

const handleCreateFine = async (loanId: number) => {
  const loan = await handleCheckLoanExist(loanId);
  let fineAmount = 0;
  let fineReason = "";
  if (loan.status === "LOST") {
    fineAmount = loan.bookCopy.books.price;
    fineReason = loan.status;
  } else if (loan.status === "OVERDUE") {
    const daysLate = Math.ceil(
      (loan.returnDate.getTime() - loan.dueDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    fineAmount = Math.max(1, daysLate) * 10000;
    fineReason = loan.status;
  }

  const fine = await prisma.fine.create({
    data: {
      amount: fineAmount,
      reason: fineReason,
      loanId,
      userId: loan.userId,
    },
  });
  return fine;
};

const handleCheckFineExist = async (fineId: number) => {
  const fine = await prisma.fine.findUnique({
    where: { id: fineId },
    include: {
      user: true,
      loan: { include: { bookCopy: { include: { books: true } } } },
    },
  });
  if (!fine) throw new Error("Fined not found");
  return fine;
};
export { handleCreateFine, handleCheckFineExist };
