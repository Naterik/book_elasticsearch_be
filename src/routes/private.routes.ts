import { fetchAccount } from "controllers/auth.controller";
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
  postBook,
  putBook,
  returnBook,
} from "controllers/book/book.controller";
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
  getUserById,
  postUser,
  putUser,
} from "controllers/user.controller";
import express, { Express } from "express";
import fileUploadMiddleware from "middleware/multer.middleware";
import { postWorksIdOpen } from "controllers/import/import.workid";
import {
  createLoans,
  getAllLoans,
  getLoanReturnById,
  getOnLoanById,
  renewalLoans,
} from "controllers/loan.controller";
import {
  createReservation,
  deleteReservation,
  getAllReservations,
  getReservationById,
  getReservationByUserId,
  putCancelReservationStatus,
  updateReservation,
} from "controllers/reservation.controller";
import {
  createPaymentFine,
  paymentUpdateStatusForFine,
  paymentUpdateStatusUser,
} from "controllers/payment.controller";
import {
  deleteFined,
  getAllFined,
  getFinedById,
  postFined,
  putFined,
} from "controllers/fine.controller";

const privateRouter = express.Router();

privateRouter.get("/account", fetchAccount);

privateRouter.get("/users", getAllUser);
privateRouter.get("/users/:id", getUserById);
privateRouter.post("/users", fileUploadMiddleware("avatar", "users"), postUser);
privateRouter.put("/users", fileUploadMiddleware("avatar", "users"), putUser);
privateRouter.delete("/users/:id", deleteUser);

privateRouter.get("/authors", getAllAuthor);
privateRouter.post("/authors", postAuthor);
privateRouter.post("/authors/bulk", postManyAuthors);
privateRouter.put("/authors", putAuthor);
privateRouter.delete("/authors/:id", deleteAuthor);

privateRouter.get("/publishers", getAllPublisher);
privateRouter.post("/publishers", postPublisher);
privateRouter.put("/publishers", putPublisher);
privateRouter.delete("/publishers/:id", deletePublisher);

privateRouter.get("/genres", getAllGenre);
privateRouter.get("/genres/display", getAllGenreDisplay);
privateRouter.post("/genres", postGenre);
privateRouter.put("/genres", putGenre);
privateRouter.delete("/genres/:id", deleteGenre);

privateRouter.post("/books", fileUploadMiddleware("image", "books"), postBook);
privateRouter.put("/books", fileUploadMiddleware("image", "books"), putBook);
privateRouter.delete("/books/:id", deleteBook);
privateRouter.put("/books/return", returnBook);

//member
privateRouter.post("/users/member", createMemberCard);
privateRouter.post("/users/member/update-status", paymentUpdateStatusUser);
privateRouter.post("/users/fine", createPaymentFine);
privateRouter.post("/users/fine/update-status", paymentUpdateStatusForFine);

privateRouter.get("/loans", getAllLoans);
privateRouter.post("/loans/create", createLoans);
privateRouter.put("/loans/renewal", renewalLoans);
privateRouter.get("/loans/:id", getOnLoanById);
privateRouter.get("/loans/returned/:id", getLoanReturnById);

privateRouter.get("/fines", getAllFined);
privateRouter.get("/fines/:id", getFinedById);

privateRouter.post("/fines", postFined);
privateRouter.put("/fines", putFined);
privateRouter.delete("/fines/:id", deleteFined);

privateRouter.post("/reservations/create", createReservation);
privateRouter.get("/reservations", getAllReservations);
privateRouter.get("/reservations/:id", getReservationById);
privateRouter.get("/reservations/users/:id", getReservationByUserId);
privateRouter.put("/reservations/:id", putCancelReservationStatus);
privateRouter.put("/reservations", updateReservation);
privateRouter.delete("/reservations/:id", deleteReservation);

privateRouter.get("/book-copies", getAllBookCopy);
privateRouter.post("/book-copies", postBookCopy);
privateRouter.put("/book-copies", putBookCopy);
privateRouter.delete("/book-copies/:id", deleteBookCopy);

//openLibrary
privateRouter.post("/authors/openlibrary", createAuthorFromOpenLibrary);
privateRouter.post("/books/open", createBooksFromOpenLibrary);
privateRouter.post("/worksid/open", postWorksIdOpen);
//auth

export default privateRouter;
