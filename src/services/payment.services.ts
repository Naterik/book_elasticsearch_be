import { prisma } from "configs/client";
import { v4 as uuidv4 } from "uuid";

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
      omit: {
        password: true,
        googleId: true,
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
    return updateUser;
  });
};

//
const handleCreatePaymentForFine = async (
  fineId: number,
  paymentRef: string
) => {
  const fine = await prisma.fine.findUnique({
    where: { id: fineId },
    include: {
      user: true,
      loan: {
        include: {
          bookCopy: {
            include: { books: { select: { title: true, id: true } } },
          },
        },
      },
    },
  });
  if (!fine) throw new Error("Fined not found");

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
const handlePayFine = async (paymentRef: string, paymentStatus: string) => {
  return prisma.$transaction(async (tx) => {
    const fine = await tx.payment.findFirst({
      where: { paymentRef },
      include: {
        user: { select: { id: true, status: true } },
      },
    });
    if (paymentStatus === "PAYMENT_FAILED") {
      await prisma.notification.create({
        data: {
          userId: fine.userId,
          type: "FINED_FAILED",
          content: `Fined created fail`,
          sentAt: new Date(),
        },
      });
      return { message: "PAYMENT_FAILED" };
    }
    const updatePayment = await tx.payment.update({
      where: { fineId: fine.id },
      data: {
        status: paymentStatus,
        paymentDate: new Date(),
      },
    });
    const updateUserStatus = await tx.user.update({
      where: { id: fine.userId },
      data: {
        status: "ACTIVE",
      },
    });
    const updateFine = await tx.fine.update({
      where: { id: fine.fineId },
      data: {
        isPaid: true,
      },
    });
    const notification = await tx.notification.create({
      data: {
        userId: fine.userId,
        type: "PAYMENT_RECEIVED",
        content: `Payment success ${fine.amount.toLocaleString(
          "vi-VN"
        )} VND for the"${fine.type}"`,
        sentAt: new Date(),
      },
    });
    return updatePayment;
  });
};

export { handlePaymentUpdateStatus, handlePayFine, handleCreatePaymentForFine };
