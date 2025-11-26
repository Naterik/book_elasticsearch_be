import { prisma } from "configs/client";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";
import { TIMEOUT } from "node:dns";

const getAllPayments = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalPayments = await prisma.payment.count();
  const totalPages = Math.ceil(countTotalPayments / +pageSize);
  const result = await prisma.payment.findMany({
    skip,
    take: +pageSize,
    orderBy: { id: "desc" },
    include: {
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
      fine: {
        include: {
          loan: {
            include: {
              bookCopy: {
                include: {
                  books: {
                    select: { title: true, id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +pageSize,
      totalItems: countTotalPayments,
    },
  };
};

const updateMembershipPaymentStatus = async (
  paymentStatus: string,
  paymentRef: string,
  paymentType: string = "membership"
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
  const fine = await prisma.fine.findFirst({
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

const payFine = async (
  paymentRef: string,
  paymentStatus: string,
  paymentType: string = "fine"
) => {
  return prisma.$transaction(
    async (tx) => {
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
        where: { fineId: fine.fineId },
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
    },
    { timeout: 10000 }
  );
};

const updatePaymentStatus = async (paymentId: number, status: string) => {
  // Validate status
  const validStatuses = ["PENDING", "COMPLETED", "PAYMENT_FAILED", "REFUNDED"];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid payment status. Must be one of: ${validStatuses.join(", ")}`
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: true,
      fine: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status,
        paymentDate: status === "COMPLETED" ? new Date() : payment.paymentDate,
      },
      include: {
        user: {
          omit: {
            password: true,
            googleId: true,
            type: true,
          },
        },
        fine: true,
      },
    });

    // If payment is completed and related to a fine, update fine status
    if (status === "COMPLETED" && payment.fineId) {
      await tx.fine.update({
        where: { id: payment.fineId },
        data: { isPaid: true },
      });

      // Update user status to ACTIVE if they were INACTIVE or SUSPENDED
      if (payment.user.status !== "ACTIVE") {
        await tx.user.update({
          where: { id: payment.userId },
          data: { status: "ACTIVE" },
        });
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: "PAYMENT_RECEIVED",
          content: `Payment of ${payment.amount.toLocaleString(
            "vi-VN"
          )} VND has been completed successfully.`,
          sentAt: new Date(),
        },
      });
    }

    return updatedPayment;
  });
};

const handleDeletePayment = async (paymentId: number) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      fine: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  // Only allow deletion of PENDING or PAYMENT_FAILED payments
  if (payment.status === "COMPLETED") {
    throw new Error(
      "Cannot delete a completed payment. Consider refunding instead."
    );
  }

  return prisma.$transaction(async (tx) => {
    // If payment is linked to a fine, ensure fine is not marked as paid
    if (payment.fineId) {
      await tx.fine.update({
        where: { id: payment.fineId },
        data: { isPaid: false },
      });
    }

    const result = await tx.payment.delete({
      where: { id: paymentId },
    });

    // Create notification
    await tx.notification.create({
      data: {
        userId: payment.userId,
        type: "PAYMENT_CANCELLED",
        content: `Payment of ${payment.amount.toLocaleString(
          "vi-VN"
        )} VND has been cancelled.`,
        sentAt: new Date(),
      },
    });

    return result;
  });
};

const handleGetPaymentById = async (paymentId: number) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
      fine: {
        include: {
          loan: {
            include: {
              bookCopy: {
                include: {
                  books: {
                    select: { title: true, id: true, isbn: true, price: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  return payment;
};

export {
  getAllPayments as getAllPaymentsService,
  updateMembershipPaymentStatus,
  payFine,
  handleCreatePaymentForFine as createPaymentForFine,
  updatePaymentStatus as updatePaymentStatusService,
  handleDeletePayment as deletePaymentService,
  handleGetPaymentById as getPaymentByIdService,
};
