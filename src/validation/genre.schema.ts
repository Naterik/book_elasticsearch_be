import * as z from "zod";

export const Genre = z.object({
  id: z.string(),
  name: z.string().min(3),
  description: z.string().min(1),
});

export type TGenre = z.infer<typeof Genre>;
