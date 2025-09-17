import { loginUser } from "controllers/auth.controller";
import {
  deleteUser,
  getAllUser,
  postUser,
  putUser,
} from "controllers/user.controller";
import express, { Express } from "express";
import verifyValidJWT from "middleware/jwt.middleware";
import fileUploadMiddleware from "middleware/multer.middleware";

const router = express.Router();
const apiRoutes = (app: Express) => {
  router.get("/users", getAllUser);
  router.post("/users", fileUploadMiddleware("avatar"), postUser);
  router.put("/users", fileUploadMiddleware("avatar"), putUser);
  router.delete("/users/:id", deleteUser);

  //auth
  router.post("/login", loginUser);

  app.use("/api/v1", verifyValidJWT, router);
};

export default apiRoutes;
