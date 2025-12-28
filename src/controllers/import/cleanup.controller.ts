import { Request, Response } from "express";
import { prisma } from "configs/client";

/**
 * Helper: Kiểm tra ISBN có hợp lệ để import không
 * Logic:
 *  1. Độ dài phải là 13
 *  2. Phải là chuỗi số
 *  3. (Optional) Check API OpenLibrary
 */
export async function isValidIsbnForImport(isbn: string): Promise<boolean> {
  // 1. Basic format validations
  const cleanIsbn = isbn.trim();
  
  // Must be length 13
  if (cleanIsbn.length !== 13) return false;
  
  // Must be numeric
  if (!/^\d+$/.test(cleanIsbn)) return false;

  // 2. OpenLibrary Verification (Simulated as requested)
  // Trong thực tế, bạn có thể gọi API thật. Ở đây ta dùng fetch để check thử
  // API: https://openlibrary.org/api/volumes/brief/isbn/{isbn}.json
  try {
    const url = `https://openlibrary.org/api/volumes/brief/isbn/${cleanIsbn}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return false;

    const data = await res.json();
    // Nếu object rỗng {} => Invalid
    if (Object.keys(data).length === 0) return false;
    
    return true;
  } catch (error) {
    console.error(`Error validating ISBN ${cleanIsbn}:`, error);
    // Nếu lỗi mạng, có thể coi là false hoặc true tùy strategy. 
    // Ở đây đánh dấu là false để an toàn (strict mode).
    return false;
  }
}

/**
 * Controller: Clean Dirty Book Data
 * Tiêu chí xóa (OR logic):
 *  - ISBN bắt đầu bằng 'OL-'
 *  - ISBN kết thúc bằng 'W'
 *  - ISBN không phải số (chứa chữ cái khác)
 *  - Độ dài khác 13
 * 
 * Quy trình:
 *  1. Quét toàn bộ Book (Batching nếu cần, nhưng delete where condition cũng được nếu DB mạnh)
 *     Tuy nhiên, do cần check logic string phức tạp mà Prisma raw filtering có thể hạn chế,
 *     ta sẽ fetch all scan hoặc dùng raw query.
 *     NHƯNG: Để an toàn và delete relations, ta nên fetch ID sau đó delete transaction.
 */
export const cleanupBookData = async (req: Request, res: Response) => {
  try {
    console.log("🧹 Starting Data Cleanup Job...");

    // Bước 1: Tìm các Book ID cần xóa
    // Do điều kiện phức tạp, ta sẽ fetch ISBN và ID để filter bằng Code (JS) cho linh hoạt
    // Lưu ý: Nếu DB quá lớn (>100k rows), cần dùng cursor/pagination. 
    // Giả sử DB hiện tại nhỏ trung bình, ta fetch chunk.
    
    // Tiêu chí tìm kiếm sơ bộ qua Prisma (để giảm load)
    // Không dễ filter 'length != 13' hay 'endsWith W' chuẩn xác 100% trong Prisma query standard 
    // mà không dùng Raw Query. Ta sẽ fetch hết các cột id, isbn.
    const allBooks = await prisma.book.findMany({
      select: { id: true, isbn: true },
    });

    const idsToDelete: number[] = [];
    const isbnsToDelete: string[] = [];

    for (const book of allBooks) {
      const isbn = book.isbn.trim();
      let shouldDelete = false;

      // Rule 1: Starts with 'OL-'
      if (isbn.startsWith("OL-")) shouldDelete = true;
      
      // Rule 2: Ends with 'W'
      else if (isbn.endsWith("W")) shouldDelete = true;
      
      // Rule 3: Length !== 13 (Loại bỏ ISBN-10, empty, etc)
      else if (isbn.length !== 13) shouldDelete = true;
      
      // Rule 4: Not numeric (contains non-digits)
      // Regex check: Nếu chứa ký tự không phải số
      else if (!/^\d+$/.test(isbn)) shouldDelete = true;

      if (shouldDelete) {
        idsToDelete.push(book.id);
        isbnsToDelete.push(isbn);
      }
    }

    const count = idsToDelete.length;
    console.log(`🔍 Found ${count} invalid books to delete.`);

    if (count === 0) {
      return res.status(200).json({ 
        message: "No invalid records found. Database is clean!", 
        deletedCount: 0 
      });
    }

    // Bước 2: Thực hiện Delete an toàn với Transaction
    // Cần xóa các bảng con trước:
    // Book -> BookCopy -> Loan -> (Fine, Payment)
    // Book -> Reservation
    // Book -> BooksOnGenres
    // Book -> DigitalBook (Cascade có sẵn nhưng cứ include cho chắc)

    // Chia nhỏ batch để delete nếu số lượng quá lớn (ví dụ > 500)
    const BATCH_SIZE = 100;
    let deletedCount = 0;

    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batchIds = idsToDelete.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(async (tx) => {
        // 1. Find BookCopies to delete Loans first
        const copies = await tx.bookcopy.findMany({
          where: { bookId: { in: batchIds } },
          select: { id: true }
        });
        const copyIds = copies.map(c => c.id);

        if (copyIds.length > 0) {
          // Find Loans
          const loans = await tx.loan.findMany({
            where: { bookcopyId: { in: copyIds } },
            select: { id: true }
          });
          const loanIds = loans.map(l => l.id);

          if (loanIds.length > 0) {
             // Delete Loan Relations (Fines, Payments usually linked to user/loan)
             // Check schema: Fine has loanId (unique), Payment has fineId (unique) or userId.
             // Payment -> User, Fine. 
             // Fine -> Loan.
             
             // Delete Payments linked to Fines of these Loans
             // Find fines for these loans
             const fines = await tx.fine.findMany({
                where: { loanId: { in: loanIds } },
                select: { id: true }
             });
             const fineIds = fines.map(f => f.id);
             
             if (fineIds.length > 0) {
                await tx.payment.deleteMany({
                  where: { fineId: { in: fineIds } }
                });
                
                await tx.fine.deleteMany({
                  where: { id: { in: fineIds } }
                });
             }

             // Delete Loans
             await tx.loan.deleteMany({
                where: { id: { in: loanIds } }
             });
          }

          // Delete BookCopies
          await tx.bookcopy.deleteMany({
            where: { id: { in: copyIds } }
          });
        }

        // 2. Delete Reservations
        await tx.reservation.deleteMany({
          where: { bookId: { in: batchIds } }
        });

        // 3. Delete BooksOnGenres
        await tx.booksOnGenres.deleteMany({
          where: { bookId: { in: batchIds } }
        });

        // 4. Delete DigitalBooks (if manual needed, though Cascade is set)
        await tx.digitalBook.deleteMany({
          where: { bookId: { in: batchIds } }
        });

        // 5. Finally Delete Books
        await tx.book.deleteMany({
          where: { id: { in: batchIds } }
        });
      });

      deletedCount += batchIds.length;
      console.log(`🗑️ Progress: Deleted ${deletedCount}/${count} records...`);
    }

    return res.status(200).json({
      message: "Cleanup completed successfully.",
      totalFound: count,
      deletedCount: deletedCount,
      examples: isbnsToDelete.slice(0, 5) // Show first 5 deleted ISBNs
    });

  } catch (error: any) {
    console.error("Cleanup Error:", error);
    return res.status(500).json({ 
      error: "Internal Server Error during Cleanup", 
      details: error.message 
    });
  }
};
