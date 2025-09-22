import * as z from "zod";
export const BookCopy = z.object({
  id: z.string(),
  year_published: z.coerce.date(),
  copyNumber: z.string().min(3),
  bookId: z.string(),
  location: z.string().min(4),
});

export type TBookCopy = z.infer<typeof BookCopy>;
