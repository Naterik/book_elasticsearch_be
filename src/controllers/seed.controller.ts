import { Request, Response } from "express";
import { seedLibraryData } from "services/seed.service";
import { sendResponse } from "src/utils";

const postSeedData = async (req: Request, res: Response) => {
  try {
    const result = await seedLibraryData();
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

export { postSeedData };


