import {
  googleAccessToken,
  loginUser,
  registerUser,
} from "controllers/auth.controller";
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
import passport from "passport";

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

  router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  router.get(
    "/google/redirect",
    passport.authenticate("google", {
      failureRedirect: "/login",
    }),
    googleAccessToken
  );

  app.use("/api/v1", router);
};

export default apiRoutes;
