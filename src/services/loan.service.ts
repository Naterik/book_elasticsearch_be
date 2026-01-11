import { prisma } from "configs/client";
import { checkMemberCard } from "./member.service";
import "dotenv/config";
import { time } from "node:console";

const getAllLoansService = async (currentPage: number) => {
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
    orderBy: { loanDate: "desc" },
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

const createLoanService = async (
  userId: number,
  bookId: number,
  dueDate: string
) => {
  const { user, policy } = await checkMemberCard(userId);
  const now = new Date();
  const due =
    dueDate === "7"
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const activeLoans = await tx.loan.count({
      where: { userId, status: { in: ["ON_LOAN", "OVERDUE"] } },
    });
    if (activeLoans >= policy.maxActiveLoans) {
      throw new Error(
        `Limit reached: Maximum ${policy.maxActiveLoans} books allowed.`
      );
    }

    // Ưu tiên 1: Tìm cuốn sách đang được giữ (ON_HOLD) cho CHÍNH user này
    let targetCopy = await tx.bookcopy.findFirst({
      where: {
        bookId,
        status: "ON_HOLD",
        heldByUserId: userId,
        holdExpiryDate: { gte: now }, // Phải còn hạn giữ sách
      },
    });

    let isFromReservation = true;

    // Ưu tiên 2: Nếu không có sách giữ riêng, tìm cuốn AVAILABLE bất kỳ
    if (!targetCopy) {
      isFromReservation = false;
      targetCopy = await tx.bookcopy.findFirst({
        where: { bookId, status: "AVAILABLE" },
      });

      //Nếu tìm thấy sách Available, phải check xem có ai đang xếp hàng đợi không?
      if (targetCopy) {
        const pendingReservations = await tx.reservation.count({
          where: { bookId, status: { in: ["PENDING", "NOTIFIED"] } },
        });

        // Nếu có người đang đợi mà sách lại Available (có thể do lỗi quy trình trả sách chưa gán hold),
        // ta nên chặn hoặc cảnh báo. Ở đây chọn cách chặn để bảo vệ quyền lợi người đặt trước.
        if (pendingReservations > 0) {
          throw new Error(
            "This book has pending reservations. Staff needs to process it for the queue."
          );
        }
      }
    }

    // Nếu vẫn không tìm thấy copy nào
    if (!targetCopy) {
      throw new Error(
        "No copies available directly or held for you. Please make a reservation."
      );
    }

    // Dùng updateMany với where clause chi tiết để đảm bảo trạng thái không bị đổi bởi request khác giữa chừng
    const updateCopyResult = await tx.bookcopy.updateMany({
      where: {
        id: targetCopy.id,
        status: targetCopy.status, // status phải y nguyên như lúc find
      },
      data: {
        status: "ON_LOAN",
        heldByUserId: null, // Xóa người giữ
        holdExpiryDate: null, // Xóa hạn giữ
      },
    });

    if (updateCopyResult.count === 0) {
      throw new Error(
        "System conflict: The book copy was taken by someone else just now. Please try again."
      );
    }
    // 4. Tạo bản ghi Loan
    const loan = await tx.loan.create({
      data: {
        userId,
        bookcopyId: targetCopy.id,
        loanDate: now,
        dueDate: due,
        status: "ON_LOAN",
      },
    });

    // 5. Cập nhật số lượng đã mượn
    await tx.book.update({
      where: { id: bookId },
      data: { borrowed: { increment: 1 } },
    });

    // 6. Xử lý đóng Reservation (Nếu mượn từ nguồn ON_HOLD)
    if (isFromReservation) {
      // Tìm reservation tương ứng và đóng lại
      const reservation = await tx.reservation.findFirst({
        where: { userId, bookId, status: "NOTIFIED" },
      });
      if (reservation) {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "COMPLETED" },
        });
      }
    }
    await tx.notification.create({
      data: {
        userId,
        type: "LOAN_CREATED",
        content: `Loan successful! Due date: ${due.toLocaleDateString(
          "vi-VN"
        )}`,
      },
    });

    return loan;
  });
};

const checkBookIsLoaned = async (userId: number) => {
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

const renewalLoan = async (loanId: number, userId: number) => {
  const { user } = await checkMemberCard(userId);
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

const getLoanById = async (loanId: number) => {
    const result = await prisma.loan.findUnique({
    where: { id: loanId },  
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
          type: true,
        },
      },
    },
  });
  return result;
};

const updateLoanStatus = async (loanId: number, userId: number) => {
  const { policy } = await checkMemberCard(userId);
  const returnDate = new Date();
  const loan = await getLoanById(loanId);
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

const getLoanByUserId = async (userId: number) => {
  const result = await prisma.loan.findMany({
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
      user: {
        omit: {
          password: true,
          type: true,
        },
      },
    },
  });
  return result;
};


const getLoanReturnByIdService = async (userId: number) => {
  const result = await prisma.loan.findMany({
    where: { userId, status: "RETURNED" },
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
          type: true,
        },
      },
    },
  });
  return result;
};

const updateLoanService = async (
  loanId: number,
  userId: number,
  dueDate?: Date,
  status?: string
) => {
  const loan = await getLoanById(loanId);

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
          type: true,
        },
      },
    },
  });

  return result;
};

const deleteLoanService = async (loanId: number) => {
  const loan = await getLoanById(loanId);
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

const approveReturnBook = async (loanId: number, userId: number) => {
  const loan = await getLoanById(loanId);
  const returnDate = new Date(); //
  const daysLate = Math.ceil(
    (returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  // const late = Math.ceil(
  //   (returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  // );
  // const daysLate = Math.max(1, late);
  // console.log("daysLate :>> ", daysLate);
  let newLoanStatus: "RETURNED" | "OVERDUE" | "LOST";
  if (daysLate <= 0) {
    newLoanStatus = "RETURNED";
  } else if (daysLate > 0 && daysLate <= 30) {
    newLoanStatus = "OVERDUE";
  } else {
    newLoanStatus = "LOST";
  }

  let fineData = null;
  if (!(newLoanStatus === "RETURNED")) {
    let fineAmount = 0;
    if (newLoanStatus === "LOST") {
      fineAmount = loan.bookCopy.books.price;
    } else if (newLoanStatus === "OVERDUE") {
      fineAmount = Math.max(1, daysLate) * 10000;
    }
    fineData = {
      amount: fineAmount,
      reason: newLoanStatus,
      loanId: loan.id,
      userId: loan.userId,
    };
  }
  let newBookCopyStatus = newLoanStatus === "LOST" ? "LOST" : "AVAILABLE";
  return prisma.$transaction(async (tx) => {
    const loanUpdate = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: newLoanStatus,
        returnDate: returnDate,
      },
    });
    const result = await tx.book.update({
      where: { id: loan.bookCopy.books.id },
      data: {
        borrowed: { decrement: 1 },
      },
    });
    let heldForUser = null;
    let holdExpires: Date | null = null;

    if (newLoanStatus !== "LOST") {
      const nextReservation = await tx.reservation.findFirst({
        where: {
          bookId: loan.bookCopy.bookId,
          status: "PENDING",
        },
        orderBy: {
          requestDate: "asc",
        },
      });

      if (nextReservation) {
        newBookCopyStatus = "ON_HOLD";
        heldForUser = nextReservation.userId;
        holdExpires = new Date();
        holdExpires.setDate(holdExpires.getDate() + 3);

        await tx.reservation.update({
          where: { id: nextReservation.id },
          data: { status: "NOTIFIED" },
        });

        await tx.notification.create({
          data: {
            userId: nextReservation.userId,
            type: "RESERVATION_READY",
            content: `This book "${
              loan.bookCopy.books.title
            }" is now available. Please pick it up before ${holdExpires.toLocaleDateString(
              "vi-VN"
            )}.`,
            sentAt: new Date(),
          },
        });
      }
    }

    await tx.bookcopy.update({
      where: { id: loan.bookCopy.id },
      data: {
        status: newBookCopyStatus,
        heldByUserId: null,
      },
    });

    if (fineData) {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: newLoanStatus === "OVERDUE" ? "INACTIVE" : "SUSPENDED",
        },
      });

      await tx.fine.create({
        data: fineData,
      });
    }
    const notificationContent = !fineData
      ? "You have successfully returned the book."
      : `You have been fined with the "${loan.bookCopy.books.title}" for ${newLoanStatus} `;

    const notification = await tx.notification.create({
      data: {
        userId: loan.userId,
        type: !fineData ? "SUCCESS_RETURNED" : "FINE_CREATED",
        content: notificationContent,
        sentAt: new Date(),
      },
    });

    return loanUpdate;
  });
};

const processOverdueLoans = async () => {
  const now = new Date();
  console.log(`[Cron] Starting overdue loans check at ${now.toISOString()}`);
  
  const BATCH_SIZE = 50;

  try {
    // 1. Tìm tổng số bản ghi thỏa mãn điều kiện
    // status = 'ON_LOAN' và dueDate < now
    const totalCount = await prisma.loan.count({
      where: {
        status: "ON_LOAN",
        dueDate: { lt: now },
      },
    });

    if (totalCount === 0) {
      console.log("[Cron] No overdue loans found.");
      return;
    }

    console.log(`[Cron] Found ${totalCount} overdue loans. Processing...`);

    let processedCount = 0;

    // 2. Xử lý theo lô (Batch Processing)
    // Vì ta update trạng thái bản ghi từ ON_LOAN -> OVERDUE,
    // nên lần query tiếp theo sẽ tự động lấy các bản ghi khác chưa xử lý.
    while (processedCount < totalCount) {
      const loans = await prisma.loan.findMany({
        where: {
          status: "ON_LOAN",
          dueDate: { lt: now },
        },
        take: BATCH_SIZE,
        select: { id: true, userId: true },
      });

      if (loans.length === 0) break;

      // Xử lý song song các khoản vay trong batch hiện tại
      await Promise.all(
        loans.map(async (loan) => {
          try {
            await prisma.$transaction(async (tx) => {
              // 1. Cập nhật status -> OVERDUE
              await tx.loan.update({
                where: { id: loan.id },
                data: { status: "OVERDUE" },
              });

              // 2. Gửi Notification
              await tx.notification.create({
                data: {
                  userId: loan.userId,
                  type: "LOAN_OVERDUE",
                  title: "Sách quá hạn / Overdue Book",
                  content:
                    "Sách của bạn đã quá hạn. Vui lòng trả sách sớm! (Your book is overdue. Please return it soon!)",
                  priority: "HIGH",
                },
              });

              // 3. Tạo Fine (Phạt 5000đ)
              // Kiểm tra xem đã có fine chưa để tránh lỗi unique constraint (dù logic cũ loan status ON_LOAN thường chưa có fine)
              const existingFine = await tx.fine.findUnique({
                 where: { loanId: loan.id }
              });

              if (!existingFine) {
                await tx.fine.create({
                    data: {
                    amount: 5000,
                    reason: "OVERDUE_AUTO_CRON",
                    isPaid: false,
                    loanId: loan.id,
                    userId: loan.userId,
                    },
                });
              }
            });
          } catch (err: any) {
            console.error(
              `[Cron] Error processing loan ID ${loan.id}:`,
              err.message
            );
          }
        })
      );

      processedCount += loans.length;
      console.log(`[Cron] Processed ${processedCount}/${totalCount} records...`);
    }

    console.log(
      `[Cron] Finished overdue loans check at ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error("[Cron] Global Error in processOverdueLoans:", error);
  }
};

export {
  getAllLoansService,
  createLoanService,
  renewalLoan,
  updateLoanStatus,
  getLoanById,
  getLoanByUserId,
  getLoanReturnByIdService,
  checkBookIsLoaned,
  updateLoanService,
  deleteLoanService,
  approveReturnBook,
  processOverdueLoans,
  
};
