import { prisma } from "configs/client";
import dayjs, { type ManipulateType } from "dayjs";
import { Timeframe } from "src/types";
import { filterWithDate } from "utils/index";

const getDashboardSummary = async () => {
  const currentMonth = {
    start: dayjs().startOf("month").toDate(),
    end: dayjs().endOf("month").toDate(),
  };
  const previousMonth = {
    start: dayjs().subtract(1, "month").startOf("month").toDate(),
    end: dayjs().subtract(1, "month").endOf("month").toDate(),
  };

  const [
    currentRevenue,
    previousRevenue,
    currentUserWithCard,
    previousUserWithCard,
    currentOverdueLoans,
    previousOverdueLoans,
    currentPendingReservations,
    previousPendingReservations,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        paymentDate: {
          gte: currentMonth.start,
          lte: currentMonth.end,
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        paymentDate: {
          gte: previousMonth.start,
          lte: previousMonth.end,
        },
      },
    }),
    prisma.user.count({
      where: {
        status: "ACTIVE",
        membershipStart: {
          gte: currentMonth.start,
          lte: currentMonth.end,
        },
      },
    }),

    prisma.user.count({
      where: {
        status: "ACTIVE",
        membershipStart: {
          gte: previousMonth.start,
          lte: previousMonth.end,
        },
      },
    }),

    prisma.loan.count({
      where: {
        status: "OVERDUE",
      },
    }),

    prisma.loan.count({
      where: {
        status: "OVERDUE",
        dueDate: {
          gte: previousMonth.start,
          lte: previousMonth.end,
        },
      },
    }),

    prisma.reservation.count({
      where: {
        status: "PENDING",
      },
    }),

    prisma.reservation.count({
      where: {
        status: "PENDING",
        requestDate: {
          gte: previousMonth.start,
          lte: previousMonth.end,
        },
      },
    }),
  ]);

  const calculatePercentageChange = (
    current: number,
    previous: number
  ): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  };

  const currentRevenueValue = currentRevenue._sum.amount || 0;
  const previousRevenueValue = previousRevenue._sum.amount || 0;

  return {
    monthlyRevenue: {
      value: currentRevenueValue,
      change: calculatePercentageChange(
        currentRevenueValue,
        previousRevenueValue
      ),
      trend: currentRevenueValue >= previousRevenueValue ? "up" : "down",
    },
    userWithCard: {
      value: currentUserWithCard,
      change: calculatePercentageChange(
        currentUserWithCard,
        previousUserWithCard
      ),
      trend: currentUserWithCard >= previousUserWithCard ? "up" : "down",
    },
    overdueLoans: {
      value: currentOverdueLoans,
      change: calculatePercentageChange(
        currentOverdueLoans,
        previousOverdueLoans
      ),
      trend: currentOverdueLoans >= previousOverdueLoans ? "up" : "down",
    },
    pendingReservations: {
      value: currentPendingReservations,
      change: calculatePercentageChange(
        currentPendingReservations,
        previousPendingReservations
      ),
      trend:
        currentPendingReservations >= previousPendingReservations
          ? "up"
          : "down",
    },
  };
};

const getPieChartForBookCopiesStatus = async () => {
  const bookCopiesStatus = await prisma.bookcopy.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });
  return bookCopiesStatus;
};

const getAreaChartForLoanTrends = async (timeframe: Timeframe) => {
  const start = filterWithDate(timeframe);

  const loanTrends = await prisma.loan.findMany({
    where: {
      loanDate: { gte: start },
    },
    orderBy: { loanDate: "asc" },
  });

  return loanTrends;
};

const getStackedBarChartForRevenue = async () => {
  const startDate = dayjs().subtract(6, "month").startOf("month").toDate();

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: startDate },
    },
    select: {
      paymentDate: true,
      type: true,
      amount: true,
    },
  });
  const grouped = new Map();

  payments.forEach((p) => {
    const month = dayjs(p.paymentDate).format("YYYY-MM");
    if (!grouped.has(month)) {
      grouped.set(month, {
        name: month,
        MEMBERSHIP_FEE: 0,
        FINE_PAYMENT: 0,
      });
    }
    const entry = grouped.get(month);
    if (p.type === "MEMBERSHIP_FEE") entry.MEMBERSHIP_FEE += p.amount;
    else if (p.type === "FINE_PAYMENT") entry.FINE_PAYMENT += p.amount;
  });

  return Array.from(grouped.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
};

const getHorizontalBarChartForSearchTerms = async () => {
  const topSearches = await prisma.historysearch.groupBy({
    by: ["term"],
    _count: { term: true },
    orderBy: {
      _count: {
        term: "desc",
      },
    },
    take: 10,
  });

  return topSearches.map((item) => ({
    name: item.term,
    value: item._count.term,
  }));
};

const getListPendingReservations = async () => {
  const pendingReservations = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          avatar: true,
        },
      },
      book: {
        select: {
          id: true,
          title: true,
          image: true,
          bookCopies: {
            where: {
              status: "AVAILABLE",
            },
            select: {
              id: true,
              copyNumber: true,
              location: true,
            },
          },
        },
      },
    },
    orderBy: {
      requestDate: "asc",
    },
  });

  return pendingReservations.map((res) => ({
    id: res.id,
    requestDate: res.requestDate,
    user: {
      id: res.user.id,
      name: res.user.fullName || res.user.username,
      avatar: res.user.avatar,
    },
    book: {
      id: res.book.id,
      title: res.book.title,
      image: res.book.image,
      availableCopiesCount: res.book.bookCopies.length,
      availableCopies: res.book.bookCopies,
    },
  }));
};

const getListUserWithCard = async (timeframe: Timeframe = "1m") => {
  const start = filterWithDate(timeframe);
  const user = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      membershipStart: { gte: start },
    },
    orderBy: {
      membershipStart: "desc",
    },
  });
  console.log("user :>> ", user);
  return user;
};

export {
  getDashboardSummary,
  getPieChartForBookCopiesStatus,
  getAreaChartForLoanTrends,
  getStackedBarChartForRevenue,
  getHorizontalBarChartForSearchTerms,
  getListPendingReservations,
  getListUserWithCard,
};
