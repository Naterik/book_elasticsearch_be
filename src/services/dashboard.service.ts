import { prisma } from "configs/client";

const getDashboardSummary = async () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalBooks,
    totalCopies,
    totalUsers,
    activeLoans,
    overdueLoans,
    pendingReservations,
    pendingCardApprovals,
    revenueResult,
    topBorrowedBooks,
  ] = await Promise.all([
    // 1. KPI: Tổng quan
    prisma.book.count(),
    prisma.bookcopy.count(),
    prisma.user.count(),
    prisma.loan.count({ where: { status: "ON_LOAN" } }),
    // Sách quá hạn
    prisma.loan.count({
      where: {
        OR: [
          { status: "OVERDUE" },
          { status: "ON_LOAN", dueDate: { lt: today } },
        ],
      },
    }),
    prisma.reservation.count({ where: { status: "PENDING" } }),

    // 2. Action: Cần xử lý
    prisma.user.count({ where: { status: "PENDING_CARD" } }),

    // 3. Revenue: Doanh thu tháng này
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "PAYMENT_SUCCESS",
        paymentDate: { gte: startOfMonth },
      },
    }),

    // 4. Insight: Top sách được mượn nhiều nhất (Load luôn ở summary cho đẹp)
    prisma.book.findMany({
      select: {
        id: true,
        title: true,
        borrowed: true,
        image: true,
        authors: { select: { name: true } },
      },
      orderBy: { borrowed: "desc" },
      take: 5,
    }),
  ]);

  return {
    overview: {
      totalBooks,
      totalCopies,
      totalUsers,
      activeLoans,
      overdueLoans,
      pendingReservations,
      monthlyRevenue: revenueResult._sum.amount || 0,
    },
    actions: {
      pendingCardApprovals,
    },
    topBooks: topBorrowedBooks.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.authors.name,
      borrowed: book.borrowed,
      image: book.image,
    })),
  };
};

const getDashboardCharts = async (period: string = "week") => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setHours(0, 0, 0, 0); // Reset time to start of day

  let groupBy: "day" | "month" = "day";

  switch (period) {
    case "year":
      startDate.setFullYear(today.getFullYear() - 1);
      groupBy = "month";
      break;
    case "month":
      startDate.setDate(today.getDate() - 30);
      groupBy = "day";
      break;
    case "week":
    default:
      startDate.setDate(today.getDate() - 7);
      groupBy = "day";
      break;
  }

  const [recentLoans, genreStats] = await Promise.all([
    // 1. Chart: Mượn sách theo thời gian
    prisma.loan.findMany({
      where: { loanDate: { gte: startDate } },
      select: { loanDate: true },
    }),

    // 2. Chart: Top thể loại sách
    prisma.genre.findMany({
      select: {
        name: true,
        _count: { select: { books: true } },
      },
      orderBy: { books: { _count: "desc" } },
      take: 5,
    }),
  ]);

  // Xử lý dữ liệu biểu đồ
  const loansMap = new Map<string, number>();

  if (groupBy === "day") {
    // Fill days
    const loopDate = new Date(startDate);
    while (loopDate <= today) {
      const dateStr = loopDate.toISOString().split("T")[0]; // YYYY-MM-DD
      loansMap.set(dateStr, 0);
      loopDate.setDate(loopDate.getDate() + 1);
    }

    recentLoans.forEach((loan) => {
      const dateStr = loan.loanDate.toISOString().split("T")[0];
      if (loansMap.has(dateStr)) {
        loansMap.set(dateStr, (loansMap.get(dateStr) || 0) + 1);
      }
    });
  } else {
    // Fill months for year view (Last 12 months)
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      loansMap.set(monthStr, 0);
    }

    recentLoans.forEach((loan) => {
      const d = loan.loanDate;
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (loansMap.has(monthStr)) {
        loansMap.set(monthStr, (loansMap.get(monthStr) || 0) + 1);
      }
    });
  }

  const loansTrend = Array.from(loansMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    loansTrend,
    topGenres: genreStats.map((g) => ({
      name: g.name,
      count: g._count.books,
    })),
  };
};

export { getDashboardSummary, getDashboardCharts };
