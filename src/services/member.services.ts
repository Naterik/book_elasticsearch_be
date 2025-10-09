import { prisma } from "configs/client";
import { v4 as uuidv4 } from "uuid";

const handleCreateMemberCard = async (
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

const handlePaymentUpdateStatus = async (
  paymentStatus: string,
  paymentRef: string
) => {
  let membershipStart = new Date();
  let membershipEnd = new Date();
  return await prisma.$transaction(async (tx) => {
    const checkPayment = await tx.payment.findFirst({ where: { paymentRef } });
    if (paymentStatus === "PAYMENT_FAILED")
      return await tx.notification.create({
        data: {
          userId: checkPayment.userId,
          type: "MEMBERSHIP_INACTIVE",
          content: `Card member created fail`,
          sentAt: new Date(),
        },
      });
    await tx.payment.update({
      where: { id: checkPayment.id },
      data: { status: paymentStatus, paymentDate: new Date() },
    });
    if (checkPayment.amount === 50000) {
      membershipEnd.setMonth(membershipEnd.getMonth() + 6);
    } else {
      membershipEnd.setFullYear(membershipEnd.getFullYear() + 1);
    }
    const updateUser = await tx.user.update({
      where: { id: checkPayment.userId },
      data: {
        cardNumber: uuidv4(),
        membershipStart,
        membershipEnd,
        status: "ACTIVE",
      },
    });
    const notification = await tx.notification.create({
      data: {
        userId: checkPayment.userId,
        type: "MEMBERSHIP_ACTIVATED",
        content: `Card member ${
          updateUser.cardNumber
        } has been activated. Due time to ${membershipEnd.toLocaleDateString(
          "vi-VN"
        )}`,
        sentAt: new Date(),
      },
    });
    return { updateUser, notification };
  });
};

const handleCheckMemberCard = async (userId: number) => {
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
    ? { maxActiveLoans: 5, loanDays: 14, requireNoUnpaidFine: true }
    : { maxActiveLoans: 2, loanDays: 7, requireNoUnpaidFine: false };
  if (policy.requireNoUnpaidFine) {
    const unpaid = await prisma.fine.count({
      where: { userId, isPaid: false },
    });
    if (unpaid > 0)
      throw new Error("Please pay outstanding fines before borrowing");
  }
  return { user, policy };
};

export {
  handleCreateMemberCard,
  handlePaymentUpdateStatus,
  handleCheckMemberCard,
};
