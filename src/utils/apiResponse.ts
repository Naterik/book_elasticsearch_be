import { Response } from "express";

export const sendResponse = (
  res: Response,
  statusCode: number,
  status: "success" | "error",
  message?: any,
  data: any = null
) => {
  const response: any = { status };

  if (status === "success") {
    // If only 4 arguments are passed (messageOrData is present, data is null),
    // we treat messageOrData as the data.
    // If 5 arguments are passed, we treat the 5th argument (data) as data.
    response.data = data ;
  } else {
    // For error responses, the 4th argument is always the message.
    response.message = message;
    response.data = data;
  }

  return res.status(statusCode).json(response);
};
