import * as z from "zod";


enum Status {
  AVAILABLE = "AVAILABLE",
  ON_HOLD = "ON_HOLD",
  ON_LOAN = "ON_LOAN",
  LOST = "LOST",
}
export const BookCopy = z.object({
  id: z.string(),
  year_published: z.number(),
  copyNumber: z.string().min(3),
  bookId: z.number(),
  status:z.enum([Status.AVAILABLE, Status.ON_HOLD, Status.ON_LOAN, Status.LOST]),
});

export type TBookCopy = z.infer<typeof BookCopy>;
