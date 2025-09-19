import { Response, Request } from "express";
import { handleGetAllAuthor } from "services/author.service";

const getAllAuthor = async (req: Request, res: Response) => {
  try {
    const author = await handleGetAllAuthor();
    res.status(200).json({
      data: author,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

export { getAllAuthor };
