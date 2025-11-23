import { Request, Response } from "express";
import {
  handleGetTrendingSearches,
  handleGetRecentSearches,
  handleDeleteSearch,
  handleClearAllSearches,
  handleSaveSearch,
} from "services/search.services";

const getTrendingSearches = async (req: Request, res: Response) => {
  try {
    const trendingSearches = await handleGetTrendingSearches();
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

const getUserRecentSearches = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const recentSearches = await handleGetRecentSearches(+userId);

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

const saveSearch = async (req: Request, res: Response) => {
  try {
    const { term, userId } = req.body;
    const searchHistory = await handleSaveSearch(+userId, term);

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

const clearAllUserSearches = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const result = await handleClearAllSearches(+userId);
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
  clearAllUserSearches,
  saveSearch,
};
