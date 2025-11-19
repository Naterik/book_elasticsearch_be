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
  getRecommendedBooks,
  postBook,
  putBook,
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
  deleteLoan,
  getAllLoans,
  getCheckBookIsLoan,
  getLoanReturnById,
  getOnLoanById,
  renewalLoans,
  returnBookApprove,
  updateLoan,
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
  deletePayment,
  getAllPayments,
  getPaymentById,
  paymentUpdateStatusForFine,
  paymentUpdateStatusUserForMember,
} from "controllers/payment.controller";
import {
  deleteFined,
  getAllFined,
  getFinedByUserId,
  postFined,
  putFined,
} from "controllers/fine.controller";
import { statisticDashboard } from "controllers/dashboard.controller";
import { findBookCopyLocation } from "controllers/elastic/filter.elastic";
import {
  cleanupNotifications,
  getNotificationsByUserId,
  getUnreadNotifications,
  putBulkNotification,
  putSingleNotification,
} from "controllers/notification.controller";

const privateRouter = express.Router();

privateRouter.get("/account", fetchAccount);
privateRouter.get("/dashboard/stats", statisticDashboard);

privateRouter.get("/users", getAllUser);
privateRouter.get("/users/:id", getUserById);
privateRouter.post("/users", fileUploadMiddleware("avatar", "users"), postUser);
privateRouter.put("/users", fileUploadMiddleware("avatar", "users"), putUser);
privateRouter.delete("/users/:id", deleteUser);
privateRouter.get("/users/check-loan/:id", getCheckBookIsLoan);

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
privateRouter.post("/genres", postGenre);
privateRouter.put("/genres", putGenre);
privateRouter.delete("/genres/:id", deleteGenre);
privateRouter.get("/genres/display", getAllGenreDisplay);

privateRouter.get("/books/recommend/:id", getRecommendedBooks);
privateRouter.post("/books", fileUploadMiddleware("image", "books"), postBook);
privateRouter.put("/books", fileUploadMiddleware("image", "books"), putBook);
privateRouter.delete("/books/:id", deleteBook);

//member
privateRouter.post("/users/member", createMemberCard);
privateRouter.post(
  "/users/member/update-status",
  paymentUpdateStatusUserForMember
);
privateRouter.post("/users/fine", createPaymentFine);
privateRouter.post("/users/fine/update-status", paymentUpdateStatusForFine);

privateRouter.get("/loans", getAllLoans);
privateRouter.post("/loans", createLoans);
privateRouter.put("/loans/renewal", renewalLoans);
privateRouter.get("/loans/:id", getOnLoanById);
privateRouter.get("/loans/returned/:id", getLoanReturnById);
privateRouter.put("/loans", updateLoan);
privateRouter.delete("/loans/:id", deleteLoan);
privateRouter.put("/loans/return-book", returnBookApprove);

privateRouter.get("/fines", getAllFined);
privateRouter.get("/fines/:id", getFinedByUserId);
privateRouter.post("/fines", postFined);
privateRouter.put("/fines", putFined);
privateRouter.delete("/fines/:id", deleteFined);

privateRouter.post("/reservations", createReservation);
privateRouter.get("/reservations", getAllReservations);
privateRouter.get("/reservations/:id", getReservationById);
privateRouter.get("/reservations/users/:id", getReservationByUserId);
privateRouter.put("/reservations/:id", putCancelReservationStatus);
privateRouter.put("/reservations", updateReservation);
privateRouter.delete("/reservations/:id", deleteReservation);

privateRouter.get("/notifications/:userId", getNotificationsByUserId);
privateRouter.get("/notifications/unread/:userId", getUnreadNotifications);
privateRouter.put("/notifications/:userId", putSingleNotification);
privateRouter.put("/notifications/bulk/:userId", putBulkNotification);
privateRouter.post("/notifications/cleanup", cleanupNotifications);

privateRouter.delete("/payments/:id", deletePayment);
privateRouter.get("/payments", getAllPayments);
privateRouter.get("/payments/:id", getPaymentById);

privateRouter.get("/book-copies", getAllBookCopy);
privateRouter.post("/book-copies", postBookCopy);
privateRouter.put("/book-copies", putBookCopy);
privateRouter.delete("/book-copies/:id", deleteBookCopy);
privateRouter.get("/book-copies/elastic", findBookCopyLocation);

//openLibrary
privateRouter.post("/authors/openlibrary", createAuthorFromOpenLibrary);
privateRouter.post("/books/open", createBooksFromOpenLibrary);
privateRouter.post("/worksid/open", postWorksIdOpen);
//auth

export default privateRouter;
