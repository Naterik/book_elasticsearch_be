import { Request, Response } from "express";
import { seedLibraryData } from "services/seed.service";

const postSeedData = async (req: Request, res: Response) => {
  try {
    const result = await seedLibraryData();
    res.status(200).json({
      message: "Successfully seeded mock data",
      data: result,
    });
  } catch (e: any) {
    res.status(500).json({
      message: "Failed to seed data",
      error: e.message,
    });
  }
};

export { postSeedData };
