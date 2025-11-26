import { prisma } from "configs/client";
import "dotenv/config";

const recentLimt = +process.env.LIMIT_RECENT_SEARCH;
const trendingLimit = +process.env.ITEM_PER_SECTION;
const getRecentSearchesByUserId = async (userId: number) => {
  const searches = await prisma.historysearch.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: recentLimt,
    omit: { userId: true, updatedAt: true },
  });

  return searches;
};

const getTrendingSearches = async () => {
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
    take: trendingLimit,
  });

  return trendingSearches.map((search) => ({
    term: search.term,
    count: search._count.id,
  }));
};

const addRecentSearch = async (userId: number, term: string) => {
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

const mergeRecentSearches = async (userId: number, terms: string[]) => {
  const uniqueTerms = [...new Set(terms)]; //skip the duplicates
  const result = await Promise.all(
    uniqueTerms.map((term) =>
      prisma.historysearch.upsert({
        where: {
          userId_term: {
            userId,
            term,
          },
        },
        create: {
          userId,
          term,
        },
        update: {
          updatedAt: new Date(),
        },
      })
    )
  );
  return result;
};

const deleteSearch = async (searchId: number) => {
  const search = await prisma.historysearch.findUnique({
    where: { id: searchId },
  });

  const deleteSearch = await prisma.historysearch.delete({
    where: { id: searchId, userId: search.userId },
  });

  return deleteSearch;
};

const clearAllSearches = async (userId: number) => {
  const result = await prisma.historysearch.deleteMany({
    where: { userId },
  });
  return result;
};

export {
  getRecentSearchesByUserId,
  getTrendingSearches as getTrendingSearchesService,
  addRecentSearch,
  deleteSearch,
  clearAllSearches,
  mergeRecentSearches,
};
