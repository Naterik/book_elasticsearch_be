import { prisma } from "configs/client";
import "dotenv/config";

const recentLimit = +process.env.LIMIT_RECENT_SEARCH || 10;
const trendingLimit = +process.env.ITEM_PER_SECTION || 5;
const getRecentSearchesByUserId = async (userId: number) => {
  const searches = await prisma.historysearch.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: recentLimit,
    omit: { userId: true, updatedAt: true },
  });

  return searches;
};

const getTrendingSearchesService = async () => {
  const trendingSearches = await prisma.historysearch.groupBy({
    by: ["term"],
    where: {
      updatedAt: {
        gte: new Date(new Date().setDate(new Date().getDate() - 30)),
      },
    },
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

  // Cleanup old searches if limit exceeded
  const count = await prisma.historysearch.count({ where: { userId } });
  if (count > recentLimit) {
    const excess = count - recentLimit;
    const OldestSearches = await prisma.historysearch.findMany({
      where: { userId },
      orderBy: { updatedAt: "asc" },
      take: excess,
      select: { id: true },
    });
    
    if (OldestSearches.length > 0) {
       await prisma.historysearch.deleteMany({
        where: {
          id: { in: OldestSearches.map((s) => s.id) },
        },
      });
    }
  }

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

  // Cleanup old searches if limit exceeded
  const count = await prisma.historysearch.count({ where: { userId } });
  if (count > recentLimit) {
    const excess = count - recentLimit;
    const OldestSearches = await prisma.historysearch.findMany({
      where: { userId },
      orderBy: { updatedAt: "asc" },
      take: excess,
      select: { id: true },
    });

    if (OldestSearches.length > 0) {
      await prisma.historysearch.deleteMany({
        where: {
          id: { in: OldestSearches.map((s) => s.id) },
        },
      });
    }
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
