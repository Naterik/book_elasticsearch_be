import express from "express";
import {
  getAllBook,
  getBookById,
  filterBook,
} from "controllers/book/book.controller";
import { getAllGenreDisplay } from "controllers/book/genre.controller";
import { filterElastic } from "controllers/elastic/filter.elastic";
import { countLanguage } from "controllers/elastic/aggregation.elastic";
import {
  googleAccessToken,
  loginUser,
  registerUser,
} from "controllers/auth.controller";
import {
  createIndex,
  createIndexWithToken,
} from "controllers/elastic/index.elastic";
import passport from "passport";

const publicRouter = express.Router();

publicRouter.post("/login", loginUser);
publicRouter.post("/register", registerUser);

publicRouter.get("/books", getAllBook);
publicRouter.get("/books/filter", filterBook);
publicRouter.get("/books/:id", getBookById);
publicRouter.get("/genres/display", getAllGenreDisplay);
publicRouter.get("/filter/elastic", filterElastic);
publicRouter.get("/languages/elastic", countLanguage);
publicRouter.get("/index/elastic", createIndex);
publicRouter.get("/index/elastic/ngram", createIndexWithToken);
publicRouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
publicRouter.get(
  "/google/redirect",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  googleAccessToken
);
export default publicRouter;
