import {
  fetchAccount,
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
} from "controllers/book/author.controller";
import {
  deleteBookCopy,
  getAllBookCopy,
  postBookCopy,
  putBookCopy,
} from "controllers/book/book-copy.controller";
import {
  deleteBook,
  filterBook,
  getAllBook,
  getBookById,
  postBook,
  putBook,
} from "controllers/book/book.controller";
import { fixAllPlaceholderBooks } from "controllers/import/fix.controller";
import {
  deleteGenre,
  getAllGenre,
  getAllGenreDisplay,
  postGenre,
  putGenre,
} from "controllers/book/genre.controller";
import { createAuthorFromOpenLibrary } from "controllers/import/import.authors.controller";
import { createBooksFromOpenLibrary } from "controllers/import/import.controller";

import {
  deletePublisher,
  getAllPublisher,
  postPublisher,
  putPublisher,
} from "controllers/book/publisher.controller";
import {
  createMemberCard,
  deleteUser,
  getAllUser,
  paymentUpdateStatusUser,
  postUser,
  putUser,
} from "controllers/user.controller";
import express, { Express } from "express";
import verifyValidJWT from "middleware/jwt.middleware";
import fileUploadMiddleware from "middleware/multer.middleware";
import passport from "passport";
import { postWorksIdOpen } from "controllers/import/import.workid";
import {
  createIndex,
  createIndexWithToken,
} from "controllers/elastic/index.elastic";
import { countLanguage } from "controllers/elastic/aggregation.elastic";
import { filterElastic } from "controllers/elastic/filter.elastic";
import {
  createLoans,
  getAllLoans,
  renewalLoans,
} from "controllers/loan.controller";
import { createReservation } from "controllers/reservation.controller";

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
  router.get("/genres/display", getAllGenreDisplay);
  router.post("/genres", postGenre);
  router.put("/genres", putGenre);
  router.delete("/genres/:id", deleteGenre);

  router.get("/books", getAllBook);
  router.post("/books", fileUploadMiddleware("image", "books"), postBook);
  router.put("/books", fileUploadMiddleware("image", "books"), putBook);
  router.get("/books/:id", getBookById);
  router.delete("/books/:id", deleteBook);
  router.get("/books/filter", filterBook);

  //member
  router.post("/users/member", createMemberCard);
  router.post("/users/member/update-status", paymentUpdateStatusUser);

  router.get("/loans", getAllLoans);
  router.post("/loans/create", createLoans);
  router.put("/loans/renewal", renewalLoans);

  router.post("/reservations/create", createReservation);

  //elastic
  router.get("/index/elastic", createIndex);
  router.get("/index/elastic/ngram", createIndexWithToken);
  router.get("/filter/elastic", filterElastic);
  router.get("/languages/elastic", countLanguage);

  router.get("/book-copies", getAllBookCopy);
  router.post("/book-copies", postBookCopy);
  router.put("/book-copies", putBookCopy);
  router.delete("/book-copies/:id", deleteBookCopy);

  //openLibrary
  router.post("/authors/openlibrary", createAuthorFromOpenLibrary);
  router.post("/books/open", createBooksFromOpenLibrary);
  router.post("/worksid/open", postWorksIdOpen);
  //auth
  router.post("/login", loginUser);
  router.post("/register", registerUser);
  router.get("/account", fetchAccount);
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
