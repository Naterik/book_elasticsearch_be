import { Request, Response } from "express";
import {
  getAllTrendingSearches,
  getUserRecentSearches,
  handleDeleteSearch,
  handleClearAllSearches,
  createUserRecentSearch,
  mergeUserRecentSearches,
} from "services/search.services";
import { string } from "zod";

const getTrendingSearches = async (req: Request, res: Response) => {
  try {
    const trendingSearches = await getAllTrendingSearches();
    res.status(200).json({
      data: trendingSearches,
      count: trendingSearches.length,
    });
  } catch (err: any) {
    res.status(400).json({
      data: null,
      message:
        err?.message || "An error occurred while fetching trending searches",
    });
  }
};

const getUserHistorySearches = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const recentSearches = await getUserRecentSearches(+userId);

    res.status(200).json({
      data: recentSearches,
      count: recentSearches.length,
    });
  } catch (err: any) {
    res.status(400).json({
      data: null,
      message:
        err?.message || "An error occurred while fetching recent searches",
    });
  }
};

const postMergeUserRecentSearches = async (req: Request, res: Response) => {
  try {
    const { userId, terms } = req.body;
    console.log("term :>> ", terms);
    const mergedSearches = await mergeUserRecentSearches(+userId, terms);
    res.status(200).json({
      data: mergedSearches,
    });
  } catch (err: any) {
    res.status(400).json({
      data: null,
      message:
        err?.message || "An error occurred while merging recent searches",
    });
  }
};

const postUserRecentSearch = async (req: Request, res: Response) => {
  try {
    const { term, userId } = req.body;
    const searchHistory = await createUserRecentSearch(userId, term);

    res.status(200).json({
      data: searchHistory,
    });
  } catch (err: any) {
    res.status(400).json({
      data: null,
      message: err?.message || "An error occurred while saving search",
    });
  }
};

const deleteUserSearch = async (req: Request, res: Response) => {
  try {
    const { searchId } = req.params;
    const result = await handleDeleteSearch(+searchId);

    res.status(200).json({
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      data: null,
      message: err?.message || "An error occurred while deleting search",
    });
  }
};

const deleteAllUserSearches = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        data: null,
        message: "Unauthorized: User ID not found",
      });
    }

    const result = await handleClearAllSearches(userId);
    res.status(200).json({
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      data: null,
      message: err?.message || "An error occurred while clearing searches",
    });
  }
};

export {
  getTrendingSearches,
  getUserRecentSearches,
  deleteUserSearch,
  deleteAllUserSearches,
  postUserRecentSearch,
  getUserHistorySearches,
  postMergeUserRecentSearches,
};
