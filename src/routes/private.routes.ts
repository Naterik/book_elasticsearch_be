import { cleanupAuthorsController, deleteAuthor, getAllAuthor, getAllAuthorNoPagination, getAuthorById, postAuthor, postManyAuthors, putAuthor } from 'controllers/book/author.controller';
import { deleteBookCopy, generateCopiesAll, getAllBookCopy, postBookCopy, putBookCopy } from 'controllers/book/book-copy.controller';
import { deleteBook, getRecommendedBooks, postBook, putBook } from 'controllers/book/book.controller';
import { cleanupGenresController, deleteGenre, getAllGenre, getAllGenreDisplay, getAllGenreNoPagination, getGenreById, postGenre, putGenre } from 'controllers/book/genre.controller';
import { cleanupPublishersController, deletePublisher, getAllPublisher, getAllPublisherNoPagination, getPublisherById, postPublisher, putPublisher } from 'controllers/book/publisher.controller';
import { deleteFined, getAllFined, getFinedByUserId, postFined, putFined } from 'controllers/fine.controller';
import { importBooksToReachTarget } from 'controllers/import/import.controller';

import {
  createLoans,
  deleteLoan,
  getAllLoans,
  getCheckBookIsLoan,
  getCurrentLoanById,
  getCurrentLoanByUserId,
  getLoanReturnById,
  renewalLoans,
  returnBookApprove,
  seedOverdueLoan,
  triggerOverdueCheck,
  updateLoan,
} from 'controllers/loan.controller';
import {
  cleanupNotifications,
  getNotificationsByUserId,
  getUnreadNotifications,
  putBulkNotification,
  putSingleNotification,
} from 'controllers/notification.controller';
import {
  createPaymentFine,
  deletePayment,
  getAllPayments,
  getPaymentById,
  paymentUpdateStatusForFine,
  paymentUpdateStatusUserForMember,
} from 'controllers/payment.controller';

import {
  deleteAllUserSearches,
  deleteUserSearch,
  getUserHistorySearches,
  postMergeUserRecentSearches,
  postUserRecentSearch,
} from 'controllers/search.controller';
import { createMemberCard, deleteUser, getAllUser, getUserById, postUser, putUser } from 'controllers/user.controller';
import express from 'express';
import fileUploadMiddleware from 'middleware/multer.middleware';
import {
  getChartForBookCopiesStatus,
  getChartForLoanTrends,
  getChartForRevenue,
  getChartForSearchTerms,

  getSummary,
  getUserWithCard,
} from 'controllers/dashboard.controller';
import { deleteImportedVietnameseBooks, importBooksByLanguage } from 'controllers/import/import.language.controller';
import { previewDigitalBookController } from 'controllers/book/digital.controller';
import { countStatusFromBookCopy, countYearPublishedFromBookCopy } from 'controllers/elastic/aggregation.elastic';
import { filterElasticBookCopy } from 'controllers/elastic/filter.elastic';
import { cleanupBookData, cleanupBooksNoGenres, cleanupSpecificGenres } from 'controllers/import/cleanup.controller';
import { syncDigitalBooks } from 'controllers/import/digital-sync.controller';
import { vietnameseBooksController } from 'controllers/import/import.vietnamese.controller';
import { postSeedData } from 'controllers/seed.controller';
import { fetchAccount } from 'controllers/auth.controller';

const privateRouter = express.Router();

privateRouter.get('/account', fetchAccount);

privateRouter.get('/dashboard/summary', getSummary);
privateRouter.get('/dashboard/chart/book-copies-status', getChartForBookCopiesStatus);
privateRouter.get('/dashboard/chart/loan-trends', getChartForLoanTrends);
privateRouter.get('/dashboard/chart/revenue', getChartForRevenue);
privateRouter.get('/dashboard/chart/search-terms', getChartForSearchTerms);

privateRouter.get('/dashboard/user-with-card', getUserWithCard);

privateRouter.get('/users', getAllUser);
privateRouter.get('/users/:id', getUserById);
privateRouter.post('/users', fileUploadMiddleware('avatar', 'users'), postUser);
privateRouter.put('/users', fileUploadMiddleware('avatar', 'users'), putUser);
privateRouter.delete('/users/:id', deleteUser);
privateRouter.get('/users/check-loan/:id', getCheckBookIsLoan);

privateRouter.get('/authors', getAllAuthor);
privateRouter.get('/authors/cleanup', cleanupAuthorsController);
privateRouter.get('/authors/all', getAllAuthorNoPagination);
privateRouter.post('/authors', postAuthor);
privateRouter.post('/authors/bulk', postManyAuthors);
privateRouter.put('/authors', putAuthor);
privateRouter.delete('/authors/:id', deleteAuthor);
privateRouter.get('/authors/:id', getAuthorById);

privateRouter.get('/publishers', getAllPublisher);
privateRouter.get('/publishers/cleanup', cleanupPublishersController);
privateRouter.get('/publishers/all', getAllPublisherNoPagination);
privateRouter.post('/publishers', postPublisher);
privateRouter.put('/publishers', putPublisher);
privateRouter.delete('/publishers/:id', deletePublisher);
privateRouter.get('/publishers/:id', getPublisherById);

privateRouter.get('/genres', getAllGenre);
privateRouter.get('/genres/all', getAllGenreNoPagination);
privateRouter.post('/genres', postGenre);
privateRouter.put('/genres', putGenre);
privateRouter.delete('/genres/:id', deleteGenre);
privateRouter.get('/genres/display', getAllGenreDisplay);
privateRouter.get('/genres/cleanup', cleanupGenresController);
privateRouter.get('/genres/:id', getGenreById);

privateRouter.get('/books/recommend/:id', getRecommendedBooks);
privateRouter.post('/books', fileUploadMiddleware('image', 'books'), postBook);
privateRouter.put('/books', fileUploadMiddleware('image', 'books'), putBook);
privateRouter.delete('/books/:id', deleteBook);

//member
privateRouter.post('/users/member', createMemberCard);
privateRouter.post('/users/member/update-status', paymentUpdateStatusUserForMember);
privateRouter.post('/users/fine', createPaymentFine);
privateRouter.post('/users/fine/update-status', paymentUpdateStatusForFine);

privateRouter.get('/loans', getAllLoans);
privateRouter.post('/loans', createLoans);
privateRouter.put('/loans/renewal', renewalLoans);
privateRouter.get('/loans/:id', getCurrentLoanById);
privateRouter.get('/loans/returned/:id', getLoanReturnById);
privateRouter.get('/loans/user/:id', getCurrentLoanByUserId);
privateRouter.put('/loans', updateLoan);
privateRouter.delete('/loans/:id', deleteLoan);
privateRouter.put('/loans/return-book', returnBookApprove);
privateRouter.post('/loans/cron/trigger-overdue-check', triggerOverdueCheck); // Testing Manual Trigger
privateRouter.post('/loans/seed/overdue', seedOverdueLoan); // Testing Seed Overdue Loan

privateRouter.get('/fines', getAllFined);
privateRouter.get('/fines/:id', getFinedByUserId);
privateRouter.post('/fines', postFined);
privateRouter.put('/fines', putFined);
privateRouter.delete('/fines/:id', deleteFined);

privateRouter.get('/notifications/:userId', getNotificationsByUserId);
privateRouter.get('/notifications/unread/:userId', getUnreadNotifications);
privateRouter.put('/notifications/:userId', putSingleNotification);
privateRouter.put('/notifications/bulk/:userId', putBulkNotification);
privateRouter.post('/notifications/cleanup', cleanupNotifications);

privateRouter.delete('/payments/:id', deletePayment);
privateRouter.get('/payments', getAllPayments);
privateRouter.get('/payments/:id', getPaymentById);

privateRouter.get('/book-copies', getAllBookCopy);
privateRouter.post('/book-copies', postBookCopy);
privateRouter.put('/book-copies', putBookCopy);
privateRouter.delete('/book-copies/:id', deleteBookCopy);
privateRouter.post('/book-copies/generate-all', generateCopiesAll);
privateRouter.get('/book-copies/filter', filterElasticBookCopy);
privateRouter.get('/book-copies/count-year-published', countYearPublishedFromBookCopy);
privateRouter.get('/book-copies/count-status', countStatusFromBookCopy);

privateRouter.get('/history-searches/full/:userId', getUserHistorySearches);
privateRouter.post('/history-searches/recent', postUserRecentSearch);
privateRouter.post('/history-searches/merge', postMergeUserRecentSearches);
privateRouter.delete('/history-searches/:searchId', deleteUserSearch);
privateRouter.delete('/history-searches', deleteAllUserSearches);
//openLibrary

privateRouter.post('/books/auto-import/10k', importBooksToReachTarget);

privateRouter.post('/books/import-by-language', importBooksByLanguage);
privateRouter.post('/books/delete-by-language', deleteImportedVietnameseBooks);

privateRouter.post('/books/vietnamese', vietnameseBooksController);
privateRouter.post('/books/cleanup', cleanupBookData);
privateRouter.post('/books/cleanup-no-genres', cleanupBooksNoGenres);
privateRouter.post('/books/cleanup-specific-genres', cleanupSpecificGenres);
privateRouter.post('/books/sync-digital', syncDigitalBooks);

// Inventory Management
import { checkInventoryConsistency, syncInventory } from 'controllers/inventory.controller';
privateRouter.get('/inventory/check', checkInventoryConsistency);
privateRouter.post('/inventory/sync', syncInventory);

privateRouter.post('/seed/loans', postSeedData);

export default privateRouter;
