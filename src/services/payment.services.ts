import { prisma } from "configs/client";
import { v4 as uuidv4 } from "uuid";
import { handleCheckFineExist } from "./fine.services";
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
const handleCreatePaymentForFine = async (
  fineId: number,
  paymentRef: string
) => {
  const fine = await handleCheckFineExist(fineId);
  const payment = await prisma.payment.create({
    data: {
      userId: fine.userId,
      amount: fine.amount,
      paymentDate: new Date(),
      type: "FINE_PAYMENT",
      fineId: fine.id,
      paymentRef,
    },
  });
  return { payment, fine };
};
const handlePayFine = async (
  fineId: number,
  paymentRef: string,
  paymentStatus: string
) => {
  return prisma.$transaction(async (tx) => {
    const { payment, fine } = await handleCreatePaymentForFine(
      fineId,
      paymentRef
    );

    if (paymentStatus === "PAYMENT_FAILED") {
      return await tx.notification.create({
        data: {
          userId: payment.userId,
          type: "MEMBERSHIP_INACTIVE",
          content: `Fined created fail`,
          sentAt: new Date(),
        },
      });
    }
  });
};

export { handlePaymentUpdateStatus, handlePayFine, handleCreatePaymentForFine };
