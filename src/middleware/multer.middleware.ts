import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { sendResponse } from "src/utils";
import { v4 as uuidv4 } from "uuid";

const fileUploadMiddleware = (fieldName: string, dir: string) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: "public/images/" + dir,
      filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
      },
    }),
    limits: {
      fileSize: 1024 * 1024 * 3,
    },
    fileFilter: (
      req: Express.Request,
      file: Express.Multer.File,
      cb: Function
    ) => {
      if (
        file.mimetype === "image/png" ||
        file.mimetype === "image/jpg" ||
        file.mimetype === "image/jpeg"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG and PNG images are allowed."), false);
      }
    },
  }).single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req as any, res as any, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return sendResponse(
            res,
            400,
            "error",
            "File too large. Maximum size is 3MB."
          );
        }
        return sendResponse(res, 400, "error", err.message);
      } else if (err) {
        return sendResponse(res, 400, "error", err.message);
      }
      next();
    });
  };
};

export default fileUploadMiddleware;
