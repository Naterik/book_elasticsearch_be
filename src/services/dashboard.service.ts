import { prisma } from "configs/client";
import dayjs, { type ManipulateType } from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

const getDashboardSummary = async () => {
  const [monthlyRevenue, activeLoans, overdueLoans, pendingReservations] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          paymentDate: {
            gte: dayjs().startOf("month").toDate(),
            lte: dayjs().endOf("month").toDate(),
          },
        },
      }),
      prisma.loan.count({
        where: {
          status: "ON_LOAN",
        },
      }),
      prisma.loan.count({
        where: {
          status: "OVERDUE",
        },
      }),
      prisma.reservation.count({
        where: {
          status: "PENDING",
        },
      }),
    ]);

  return {
    monthlyRevenue,
    activeLoans,
    overdueLoans,
    pendingReservations,
  };
};

const getRadarChartForBookCopiesStatus = async () => {
  const bookCopiesStatus = await prisma.bookcopy.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });
  console.log("object :>> ", bookCopiesStatus);
  return bookCopiesStatus;
};

const getAreaChartForLoanTrendsAndUserGrowth = async (
  timeframe: "7d" | "1m" | "3m" | "6m" | "1y" = "1m"
) => {
  let startDate = dayjs();
  let format = "YYYY-MM-DD";

  switch (timeframe) {
    case "7d":
      startDate = startDate.subtract(7, "day");
      break;
    case "1m":
      startDate = startDate.subtract(1, "month");
      break;
    case "3m":
      startDate = startDate.subtract(3, "month");
      break;
    case "6m":
      startDate = startDate.subtract(6, "month");
      break;
    case "1y":
      startDate = startDate.subtract(1, "year");
      break;
  }

  const start = startDate.startOf("day").toDate();

  const [loanTrends, userGrowth] = await Promise.all([
    prisma.loan.groupBy({
      by: ["loanDate"],
      _count: { loanDate: true },
      where: {
        loanDate: { gte: start },
      },
      orderBy: { loanDate: "asc" },
    }),
    prisma.user.groupBy({
      by: ["createdAt"],
      _count: { createdAt: true },
      where: {
        createdAt: { gte: start },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const mergedData = new Map();
  let currentDate = startDate;
  const now = dayjs();
  while (currentDate.isBefore(now) || currentDate.isSame(now, "day")) {
    const dateStr = currentDate.format(format);
    mergedData.set(dateStr, { date: dateStr, loan: 0, user: 0 });
    currentDate = currentDate.add(1, "day");
  }

  loanTrends.forEach((item) => {
    const dateStr = dayjs(item.loanDate).format(format);
    if (mergedData.has(dateStr)) {
      mergedData.get(dateStr).loan += item._count.loanDate;
    }
  });

  userGrowth.forEach((item) => {
    if (item.createdAt) {
      const dateStr = dayjs(item.createdAt).format(format);
      if (mergedData.has(dateStr)) {
        mergedData.get(dateStr).user += item._count.createdAt;
      }
    }
  });

  return Array.from(mergedData.values());
};

const getDonutChartForGenrePreference = async () => {
  // Lấy tất cả thể loại và sách của chúng
  const genres = await prisma.genre.findMany({
    select: {
      name: true,
      books: {
        select: {
          books: {
            select: {
              borrowed: true, // Lấy số lượt mượn của từng cuốn sách
            },
          },
        },
      },
    },
  });

  // Tính tổng lượt mượn cho mỗi thể loại
  const sortedData = genres
    .map((g) => ({
      name: g.name,
      value: g.books.reduce((sum, item) => sum + item.books.borrowed, 0),
    }))
    .filter((item) => item.value > 0) // Chỉ lấy thể loại có lượt mượn
    .sort((a, b) => b.value - a.value); // Sắp xếp giảm dần

  // Lấy Top 9
  const top9 = sortedData.slice(0, 9);

  // Tính tổng phần còn lại (Others)
  const othersValue = sortedData
    .slice(9)
    .reduce((sum, item) => sum + item.value, 0);

  if (othersValue > 0) {
    top9.push({ name: "Different", value: othersValue });
  }

  return top9;
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

  // Group theo tháng và loại
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

export {
  getDashboardSummary,
  getRadarChartForBookCopiesStatus,
  getAreaChartForLoanTrendsAndUserGrowth,
  getDonutChartForGenrePreference,
  getStackedBarChartForRevenue,
  getHorizontalBarChartForSearchTerms,
};
