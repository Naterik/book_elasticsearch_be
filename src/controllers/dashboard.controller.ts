import { Request, Response } from "express";
import { getStatisticDashboard } from "services/dashboard.service";
const statisticDashboard = async (req: Request, res: Response) => {
  try {
    const result = await getStatisticDashboard();
    res.status(200).json({ data: result });
  } catch (e: any) {
    res.status(404).json({ data: null, message: e.message });
  }
};

export { statisticDashboard };
