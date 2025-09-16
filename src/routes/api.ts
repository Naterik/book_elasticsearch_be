import {
  deleteUser,
  getAllUser,
  postUser,
  putUser,
} from "controllers/user.controller";
import express, { Express } from "express";
import fileUploadMiddleware from "middleware/multer";

const router = express.Router();
const apiRoutes = (app: Express) => {
  router.get("/users", getAllUser);
  router.post("/users", fileUploadMiddleware("avatar"), postUser);
  router.put("/users", fileUploadMiddleware("avatar"), putUser);
  router.delete("/users/:id", deleteUser);
  app.use("/api/v1", router);
};

export default apiRoutes;
