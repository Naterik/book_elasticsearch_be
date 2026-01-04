import * as z from "zod";
export const Book = z.object({
  id: z.coerce.number(),
  isbn: z.string().trim().min(10),
  title: z.string().min(3).max(255),
  shortDesc: z.string().min(10).max(255),
  detailDesc: z.string().min(10),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0),
  publishDate: z.coerce.date().optional(),
  image: z.string().optional(),
  pages: z.coerce.number().int().min(1),
  language: z.string().max(20).optional(),
  authorId: z.coerce.number().int(),
  genreIds: z.string().or(z.array(z.string())),
  publisherId: z.coerce.number().int(),
});

export type TBook = z.infer<typeof Book>;
