import {
  googleAccessToken,
  loginUser,
  registerUser,
} from "controllers/auth.controller";
import {
  deleteAuthor,
  getAllAuthor,
  postAuthor,
  postManyAuthors,
  putAuthor,
} from "controllers/author.controller";
import {
  deleteBook,
  getAllBook,
  postBook,
  putBook,
} from "controllers/book.controller";
import {
  deleteGenre,
  getAllGenre,
  postGenre,
  putGenre,
} from "controllers/genre.controller";
import { createAuthorFromOpenLibrary } from "controllers/import.controller";

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
  router.post("/users", fileUploadMiddleware("avatar", "users"), postUser);
  router.put("/users", fileUploadMiddleware("avatar", "users"), putUser);
  router.delete("/users/:id", deleteUser);

  router.get("/authors", getAllAuthor);
  router.post("/authors", postAuthor);
  router.post("/authors/bulk", postManyAuthors);
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

  router.get("/books", getAllBook);
  router.post("/books", fileUploadMiddleware("image", "books"), postBook);
  router.put("/books", fileUploadMiddleware("image", "books"), putBook);
  router.delete("/books/:id", deleteBook);

  router.post("/authors/openlibrary", createAuthorFromOpenLibrary);

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
