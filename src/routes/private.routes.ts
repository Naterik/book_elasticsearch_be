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
  generateCopiesAll,
} from "controllers/book/book-copy.controller";
import {
  deleteBook,
  getAllBookForSelect,
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
  cleanupGenresController,
} from "controllers/book/genre.controller";
import { createAuthorFromOpenLibrary } from "controllers/import/import.authors.controller";
import {
  createBooksFromOpenLibrary,
  autoImportBooksFromGenres,
  autoImportBooksFromGenresList,
} from "controllers/import/import.controller";
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
  triggerOverdueCheck,
  seedOverdueLoan,
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
import {
  cleanupNotifications,
  getNotificationsByUserId,
  getUnreadNotifications,
  putBulkNotification,
  putSingleNotification,
} from "controllers/notification.controller";
import {
  deleteAllUserSearches,
  deleteUserSearch,
  getUserHistorySearches,
  postMergeUserRecentSearches,
  postUserRecentSearch,
} from "controllers/search.controller";

import {
  getChartForBookCopiesStatus,
  getChartForLoanTrends,
  getChartForRevenue,
  getChartForSearchTerms,
  getPendingReservations,
  getSummary,
  getUserWithCard,
} from "controllers/dashboard.controller";
import {
  importBooksByLanguage,
  deleteImportedVietnameseBooks,
} from "controllers/import/import.language.controller";

import { postSeedData } from "controllers/seed.controller";
import {
  countStatusFromBookCopy,
  countYearPublishedFromBookCopy,
} from "controllers/elastic/aggregation.elastic";
import { filterElasticBookCopy } from "controllers/elastic/filter.elastic";
import { vietnameseBooksController } from "controllers/import/import.vietnamese.controller";
import {
  cleanupBookData,
  cleanupSpecificGenres,
} from "controllers/import/cleanup.controller";
import { syncDigitalBooks } from "controllers/import/digital-sync.controller";
import { previewDigitalBookController } from "controllers/book/digital.controller";

const privateRouter = express.Router();

privateRouter.get("/account", fetchAccount);

privateRouter.get("/dashboard/summary", getSummary);
privateRouter.get(
  "/dashboard/chart/book-copies-status",
  getChartForBookCopiesStatus
);
privateRouter.get("/dashboard/chart/loan-trends", getChartForLoanTrends);
privateRouter.get("/dashboard/chart/revenue", getChartForRevenue);
privateRouter.get("/dashboard/chart/search-terms", getChartForSearchTerms);
privateRouter.get("/dashboard/pending-reservations", getPendingReservations);
privateRouter.get("/dashboard/user-with-card", getUserWithCard);

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

privateRouter.get("/genres/cleanup", cleanupGenresController);

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
privateRouter.post("/loans/cron/trigger-overdue-check", triggerOverdueCheck); // Testing Manual Trigger
privateRouter.post("/loans/seed/overdue", seedOverdueLoan); // Testing Seed Overdue Loan

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
privateRouter.post("/book-copies/generate-all", generateCopiesAll);
privateRouter.get("/book-copies/filter", filterElasticBookCopy);
privateRouter.get(
  "/book-copies/count-year-published",
  countYearPublishedFromBookCopy
);
privateRouter.get("/book-copies/count-status", countStatusFromBookCopy);

privateRouter.get("/history-searches/full/:userId", getUserHistorySearches);
privateRouter.post("/history-searches/recent", postUserRecentSearch);
privateRouter.post("/history-searches/merge", postMergeUserRecentSearches);
privateRouter.delete("/history-searches/:searchId", deleteUserSearch);
privateRouter.delete("/history-searches", deleteAllUserSearches);

privateRouter.get("/digitals/preview/:isbn",previewDigitalBookController)
//openLibrary
privateRouter.post("/authors/openlibrary", createAuthorFromOpenLibrary);
privateRouter.post("/books/open", createBooksFromOpenLibrary);
privateRouter.post("/books/auto-import/genres", autoImportBooksFromGenres);
privateRouter.post(
  "/books/auto-import/genres-list",
  autoImportBooksFromGenresList
);
privateRouter.post("/worksid/open", postWorksIdOpen);

privateRouter.post("/books/import-by-language", importBooksByLanguage);
privateRouter.post("/books/delete-by-language", deleteImportedVietnameseBooks);

privateRouter.post("/books/vietnamese", vietnameseBooksController);
privateRouter.post("/books/cleanup", cleanupBookData);
privateRouter.post("/books/cleanup-specific-genres", cleanupSpecificGenres);
privateRouter.post("/books/sync-digital", syncDigitalBooks);

privateRouter.post("/seed/loans", postSeedData);

export default privateRouter;
