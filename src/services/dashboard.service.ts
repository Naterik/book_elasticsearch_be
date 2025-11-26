import { prisma } from "configs/client";

const getStatisticDashboard = async () => {
  const totalBooks = await prisma.book.count();
  const totalUsers = await prisma.user.count();
  const activeLoans = await prisma.loan.count();

  const totalSuccessfulPayments = await prisma.payment.count({
    where: { status: "PAYMENT_SUCCESS" },
  });
  return {
    totalBooks,
    totalUsers,
    activeLoans,
    totalSuccessfulPayments,
  };
};
export { getStatisticDashboard };
