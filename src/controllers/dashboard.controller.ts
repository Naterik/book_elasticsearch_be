import { Request, Response } from "express";
import {
  getAreaChartForLoanTrends,
  getDashboardSummary,
  getHorizontalBarChartForSearchTerms,
  getListUserWithCard,
  getPieChartForBookCopiesStatus,
  getStackedBarChartForRevenue,
} from "services/dashboard.service";
import { Timeframe } from "src/types";
import { sendResponse } from "src/utils";

const getSummary = async (req: Request, res: Response) => {
  try {
    const result = await getDashboardSummary();
    return sendResponse(res, 200, "success", result);
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const getChartForBookCopiesStatus = async (req: Request, res: Response) => {
  try {
    const result = await getPieChartForBookCopiesStatus();
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const getChartForLoanTrends = async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as Timeframe) || "7d";
    const result = await getAreaChartForLoanTrends(timeframe);
    return sendResponse(res, 200, "success", result);
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const getUserWithCard = async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as Timeframe) || "7d";
    const result = await getListUserWithCard(timeframe);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const getChartForRevenue = async (req: Request, res: Response) => {
  try {
    const result = await getStackedBarChartForRevenue();
    return sendResponse(res, 200, "success", result);
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};

const getChartForSearchTerms = async (req: Request, res: Response) => {
  try {
    const result = await getHorizontalBarChartForSearchTerms();
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (e: any) {
    return sendResponse(res, 500, "error", e.message);
  }
};



export {
  getSummary,
  getChartForBookCopiesStatus,
  getUserWithCard,
  getChartForRevenue,
  getChartForSearchTerms,

  getChartForLoanTrends,
};

