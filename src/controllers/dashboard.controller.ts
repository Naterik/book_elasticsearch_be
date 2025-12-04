import { Request, Response } from "express";
import {
  getAreaChartForLoanTrends,
  getDashboardSummary,
  getHorizontalBarChartForSearchTerms,
  getListPendingReservations,
  getListUserWithCard,
  getPieChartForBookCopiesStatus,
  getStackedBarChartForRevenue,
} from "services/dashboard.service";
import { Timeframe } from "src/types";

const getSummary = async (req: Request, res: Response) => {
  try {
    const result = await getDashboardSummary();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getChartForBookCopiesStatus = async (req: Request, res: Response) => {
  try {
    const result = await getPieChartForBookCopiesStatus();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getChartForLoanTrends = async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as Timeframe) || "7d";
    const result = await getAreaChartForLoanTrends(timeframe);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getUserWithCard = async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as Timeframe) || "7d";
    const result = await getListUserWithCard(timeframe);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getChartForRevenue = async (req: Request, res: Response) => {
  try {
    const result = await getStackedBarChartForRevenue();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getChartForSearchTerms = async (req: Request, res: Response) => {
  try {
    const result = await getHorizontalBarChartForSearchTerms();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getPendingReservations = async (req: Request, res: Response) => {
  try {
    const result = await getListPendingReservations();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

export {
  getSummary,
  getChartForBookCopiesStatus,
  getUserWithCard,
  getChartForRevenue,
  getChartForSearchTerms,
  getPendingReservations,
  getChartForLoanTrends,
};
