import * as z from "zod";

export const Author = z.object({
  id: z.string(),
  name: z.string().trim().min(3),
  bio: z.string().min(10).optional(),
});

export type TAuthor = z.infer<typeof Author>;
