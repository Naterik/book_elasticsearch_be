import { Request, Response } from "express";
import { previewDigitalBook } from "services/digital-preview.service";
import { sendResponse } from "src/utils";

const previewDigitalBookController = async (req: Request, res: Response) => {
  try {
    const { isbn } = req.params;
    const digitalBook = await previewDigitalBook(isbn);
    return sendResponse(
      res,
      200,
      "success",
      digitalBook
    );
  } catch (error: any) {
    console.log(error);
    return sendResponse(res, 500, "error", error.message);
  }
};

export { previewDigitalBookController };

