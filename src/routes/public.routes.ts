import express from "express";
import {
  getAllBook,
  getBookById,
  filterBook,
  getTrendingBooks,
  getNewArrivals,
  getMostBorrowedBooks,
  getAllBookForSelect,
} from "controllers/book/book.controller";
import { getAllGenreDisplay } from "controllers/book/genre.controller";
import { filterElastic } from "controllers/elastic/filter.elastic";

import {
  googleAccessToken,
  loginUser,
  logoutUser,
  registerUser,
} from "controllers/auth.controller";
import {
  createBookCopiesIndex,
  createBooksIndex,
} from "controllers/elastic/index.elastic";
import { getTrendingSearches } from "controllers/search.controller";
import passport from "passport";
import {
  countGenres,
  countLanguage,
} from "controllers/elastic/aggregation.elastic";
import { getBookCopyStatusByBookId } from "controllers/book/book-copy.controller";
import { suggestElastic } from "controllers/elastic/suggest.elastic";
import { searchBooksInstant } from "controllers/elastic/search.controller";
import { previewDigitalBookController } from "controllers/book/digital.controller";

const publicRouter = express.Router();

publicRouter.post("/logout", logoutUser);
publicRouter.post("/login", loginUser);
publicRouter.post("/register", registerUser);

publicRouter.get("/books", getAllBook);
publicRouter.get("/books/filter", filterBook);
publicRouter.get("/books/trending", getTrendingBooks);
publicRouter.get("/books/new-arrivals", getNewArrivals);
publicRouter.get("/books/most-borrowed", getMostBorrowedBooks);
publicRouter.get("/book-copies/status/:id", getBookCopyStatusByBookId);
publicRouter.get("/books/select-name", getAllBookForSelect);
publicRouter.get("/books/:id", getBookById);

publicRouter.get("/genres/display", getAllGenreDisplay);
publicRouter.get('/digitals/preview/:isbn', previewDigitalBookController);
publicRouter.get("/search/trending", getTrendingSearches);
publicRouter.get("/filter/elastic", filterElastic);
publicRouter.get("/languages/elastic", countLanguage);
publicRouter.get("/genres/elastic", countGenres);
publicRouter.get("/index/elastic/book-copies", createBookCopiesIndex);
publicRouter.get("/index/elastic/books", createBooksIndex);
publicRouter.get("/suggest/elastic", suggestElastic);
publicRouter.get("/search/instant", searchBooksInstant);

// Existing oauth routes...
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
