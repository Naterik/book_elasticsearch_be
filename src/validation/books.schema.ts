import * as z from "zod";
export const Book = z.object({
  id: z.string(),
  isbn: z.string().trim().min(10),
  title: z.string().min(3),
  shortDesc: z.string().min(10).max(255),
  detailDesc: z.string().min(10),
  price: z.string(),
  quantity: z.string(),
  publishDate: z.coerce.date().optional(),
  image: z.string().optional(),
  pages: z.string().min(1).optional(),
  language: z.string().max(20).optional(),
  authorId: z.string(),
  genreIds: z.string().or(z.array(z.string())),
  publisherId: z.string(),
});

export type TBook = z.infer<typeof Book>;
