import { Request, Response } from "express";
import {
  deletePublisherService,
  getAllPublishers,
  createPublisher,
  updatePublisher,
} from "services/book/publisher.service";
import { Publisher, TPublisher } from "validation/publisher.schema";
import { fromError } from "zod-validation-error";
import { sendResponse } from "src/utils";

const getAllPublisher = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllPublishers(currentPage);

    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

const postPublisher = async (req: Request, res: Response) => {
  try {
    Publisher.omit({ id: true }).parse(req.body);
    const { name, description } = req.body as TPublisher;
    const result = await createPublisher(name, description);
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
      fromError(err).toString() || err.message,
      null
    );
  }
};

const putPublisher = async (req: Request, res: Response) => {
  try {
    Publisher.parse(req.body);
    const { id, name, description } = req.body as TPublisher;
    const result = await updatePublisher(id, name, description);
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
      fromError(err).toString() || err.message,
      null
    );
  }
};

const deletePublisher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deletePublisherService(id);
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message, null);
  }
};

export { getAllPublisher, postPublisher, putPublisher, deletePublisher };
