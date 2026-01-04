import { Request, Response } from "express";
import {
  getRecentSearchesByUserId,
  deleteSearch,
  clearAllSearches,
  addRecentSearch,
  mergeRecentSearches,
  getTrendingSearchesService,
} from "services/search.service";
import { sendResponse } from "src/utils";

const getTrendingSearches = async (req: Request, res: Response) => {
  try {
    const trendingSearches = await getTrendingSearchesService();
    return sendResponse(
      res,
      200,
      "success",
      trendingSearches
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      err?.message || "An error occurred while fetching trending searches",
      null
    );
  }
};

const getUserHistorySearches = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const recentSearches = await getRecentSearchesByUserId(+userId);

    return sendResponse(
      res,
      200,
      "success",
      recentSearches
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      err?.message || "An error occurred while fetching recent searches",
      null
    );
  }
};

const postMergeUserRecentSearches = async (req: Request, res: Response) => {
  try {
    const { userId, terms } = req.body;
    console.log("term :>> ", terms);
    const mergedSearches = await mergeRecentSearches(+userId, terms);
    return sendResponse(
      res,
      200,
      "success",
      mergedSearches
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      err?.message || "An error occurred while merging recent searches",
      null
    );
  }
};

const postUserRecentSearch = async (req: Request, res: Response) => {
  try {
    const { term, userId } = req.body;
    const searchHistory = await addRecentSearch(userId, term);

    return sendResponse(
      res,
      200,
      "success",
      searchHistory
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      err?.message || "An error occurred while saving search",
      null
    );
  }
};

const deleteUserSearch = async (req: Request, res: Response) => {
  try {
    const { searchId } = req.params;
    const result = await deleteSearch(+searchId);

    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      err?.message || "An error occurred while deleting search",
      null
    );
  }
};

const deleteAllUserSearches = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return sendResponse(
        res,
        401,
        "error",
        "Unauthorized: User ID not found",
        null
      );
    }

    const result = await clearAllSearches(userId);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      err?.message || "An error occurred while clearing searches",
      null
    );
  }
};

export {
  getTrendingSearches,
  deleteUserSearch,
  deleteAllUserSearches,
  postUserRecentSearch,
  getUserHistorySearches,
  postMergeUserRecentSearches,
};
