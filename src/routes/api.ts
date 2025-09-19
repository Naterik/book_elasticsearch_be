import {
  googleAccessToken,
  loginUser,
  registerUser,
} from "controllers/auth.controller";
import {
  deleteAuthor,
  getAllAuthor,
  postAuthor,
  putAuthor,
} from "controllers/author.controller";
import {
  deleteGenre,
  getAllGenre,
  postGenre,
  putGenre,
} from "controllers/genre.controller";
import {
  deletePublisher,
  getAllPublisher,
  postPublisher,
  putPublisher,
} from "controllers/publisher.controller";
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
  router.post("/authors", postAuthor);
  router.put("/authors", putAuthor);
  router.delete("/authors/:id", deleteAuthor);

  router.get("/publishers", getAllPublisher);
  router.post("/publishers", postPublisher);
  router.put("/publishers", putPublisher);
  router.delete("/publishers/:id", deletePublisher);

  router.get("/genres", getAllGenre);
  router.post("/genres", postGenre);
  router.put("/genres", putGenre);
  router.delete("/genres/:id", deleteGenre);

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
      session: false,
    }),
    googleAccessToken
  );

  app.use("/api/v1", verifyValidJWT, router);
};

export default apiRoutes;
