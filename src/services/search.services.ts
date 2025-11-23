import { prisma } from "configs/client";
import "dotenv/config";

const recentLimt = +process.env.LIMIT_RECENT_SEARCH;
const handleGetRecentSearches = async (userId: number) => {
  const searches = await prisma.historysearch.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: recentLimt,
    omit: { userId: true, updatedAt: true },
  });

  return searches;
};

const handleGetTrendingSearches = async () => {
  const trendingSearches = await prisma.historysearch.groupBy({
    by: ["term"],
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
    // take: recentLimt,
  });

  return trendingSearches.map((search) => ({
    term: search.term,
    count: search._count.id,
  }));
};

const handleSaveSearch = async (userId: number, term: string) => {
  const historysearch = await prisma.historysearch.upsert({
    where: {
      userId_term: {
        userId,
        term,
      },
    },
    update: {
      updatedAt: new Date(),
    },
    create: {
      userId,
      term,
    },
    omit: { userId: true, updatedAt: true },
  });

  return historysearch;
};

const handleDeleteSearch = async (searchId: number) => {
  const search = await prisma.historysearch.findUnique({
    where: { id: searchId },
  });

  if (!search) {
    throw new Error("Search history not found");
  }

  const deleteSearch = await prisma.historysearch.delete({
    where: { id: searchId, userId: search.userId },
  });

  return deleteSearch;
};

const handleClearAllSearches = async (userId: number) => {
  const result = await prisma.historysearch.deleteMany({
    where: { userId },
  });
  return result;
};

export {
  handleGetRecentSearches,
  handleGetTrendingSearches,
  handleSaveSearch,
  handleDeleteSearch,
  handleClearAllSearches,
};
