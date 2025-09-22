import * as z from "zod";

export const Publisher = z.object({
  id: z.string(),
  name: z.string().min(3),
  description: z.string().min(1).optional(),
});

export type TPublisher = z.infer<typeof Publisher>;
