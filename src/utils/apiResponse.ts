import { Response } from "express";

export const sendResponse = (
  res: Response,
  statusCode: number,
  status: "success" | "error",
  dataOrMessage: any = null,
) => {
  const response: any = {};

  if (status === "success") {
    response.data = dataOrMessage;
  } else {
    response.error = dataOrMessage;
  }

  return res.status(statusCode).json(response);
};
