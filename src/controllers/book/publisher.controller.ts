import { Request, Response } from "express";
import {
  deletePublisherService,
  getAllPublishers,
  createPublisher,
  updatePublisher,
} from "services/book/publisher.service";
import { Publisher, TPublisher } from "validation/publisher.schema";
import { fromError } from "zod-validation-error";

const getAllPublisher = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage: number = page ? +page : 1;
    if (currentPage <= 0) currentPage = 1;

    const result = await getAllPublishers(currentPage);

    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const postPublisher = async (req: Request, res: Response) => {
  try {
    Publisher.omit({ id: true }).parse(req.body);
    const { name, description } = req.body as TPublisher;
    const result = await createPublisher(name, description);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const putPublisher = async (req: Request, res: Response) => {
  try {
    Publisher.parse(req.body);
    const { id, name, description } = req.body as TPublisher;
    const result = await updatePublisher(id, name, description);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({ message: fromError(err).toString(), data: null });
  }
};

const deletePublisher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deletePublisherService(id);
    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message, data: null });
  }
};

export { getAllPublisher, postPublisher, putPublisher, deletePublisher };
