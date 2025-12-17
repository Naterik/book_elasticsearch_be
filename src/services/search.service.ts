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

const getTrendingSearchesService = async () => {
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
  const uniqueTerms = [...new Set(terms)];
  const result = [];
  for (const term of uniqueTerms) {
    const upserted = await prisma.historysearch.upsert({
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
    });
    result.push(upserted);
  }
  return result;
};

const deleteSearch = async (searchId: number) => {
  const search = await prisma.historysearch.findUnique({
    where: { id: searchId },
  });

  if (!search) {
    throw new Error("Search history not found");
  }

  const deletedSearch = await prisma.historysearch.delete({
    where: { id: searchId },
  });

  return deletedSearch;
};

const clearAllSearches = async (userId: number) => {
  const result = await prisma.historysearch.deleteMany({
    where: { userId },
  });
  return result;
};

export {
  getRecentSearchesByUserId,
  getTrendingSearchesService,
  addRecentSearch,
  deleteSearch,
  clearAllSearches,
  mergeRecentSearches,
};
