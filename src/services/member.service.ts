import { prisma } from "configs/client";

const createMemberCard = async (
  fullName: string,
  phone: string,
  address: string,
  userId: number,
  duration: string,
  paymentRef: string | null
) => {
  const checkUser = await prisma.user.findFirst({
    where: { id: userId, status: { in: ["INACTIVE", "SUSPENDED"] } },
  });
  if (checkUser) throw new Error("User doesn't have permission");
  if (duration === "COD") {
    return await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        fullName,
        phone,
        address,
        status: "PENDING_CARD",
        roleId: 2,
      },
    });
  }
  const [updateUserInfo, payment] = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        fullName,
        phone,
        address,
        status: "PENDING_CARD",
        roleId: 2,
      },
    }),
    prisma.payment.create({
      data: {
        amount: duration === "6" ? 50000 : 100000,
        type: "MEMBERSHIP_FEE",
        userId,
        paymentRef,
      },
    }),
  ]);
  return payment;
};
const checkMemberCard = async (userId: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.status === "SUSPENDED")
    throw new Error("User doesn't have permission");
  const hasCard = !!user.cardNumber;
  const membershipValid =
    hasCard &&
    !!user.membershipEnd &&
    user.membershipEnd > new Date() &&
    user.status === "ACTIVE";
  const policy = membershipValid
    ? { maxActiveLoans: 5, loanDays: 14 }
    : { maxActiveLoans: 2, loanDays: 7 };

  return { user, policy };
};
export { createMemberCard as createMemberCardService, checkMemberCard };
