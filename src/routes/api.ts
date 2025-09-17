import { loginUser, registerUser } from "controllers/auth.controller";
import { getAllAuthor } from "controllers/author.controller";
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

  router.get("/authors", getAllAuthor);
  // router.post("/authors", postAuthor);
  // router.put("/authors", putAuthor);
  // router.delete("/authors/:id", deleteAuthor);

  //auth
  router.post("/login", loginUser);
  router.post("/register", registerUser);

  app.use("/api/v1", verifyValidJWT, router);
};

export default apiRoutes;
