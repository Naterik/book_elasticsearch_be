import { Request, Response } from "express";
import {
  getAreaChartForLoanTrendsAndUserGrowth,
  getDashboardSummary,
  getDonutChartForGenrePreference,
  getHorizontalBarChartForSearchTerms,
  getRadarChartForBookCopiesStatus,
  getStackedBarChartForRevenue,
} from "services/dashboard.service";

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
    const result = await getRadarChartForBookCopiesStatus();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getChartForLoanTrendsAndUserGrowth = async (
  req: Request,
  res: Response
) => {
  try {
    const timeframe = req.query.timeframe as
      | "7d"
      | "1m"
      | "3m"
      | "6m"
      | "1y"
      | undefined;
    const result = await getAreaChartForLoanTrendsAndUserGrowth(timeframe);
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(500).json({ data: null, message: e.message });
  }
};

const getChartForGenrePreference = async (req: Request, res: Response) => {
  try {
    const result = await getDonutChartForGenrePreference();
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

export {
  getSummary,
  getChartForBookCopiesStatus,
  getChartForLoanTrendsAndUserGrowth,
  getChartForGenrePreference,
  getChartForRevenue,
  getChartForSearchTerms,
};
