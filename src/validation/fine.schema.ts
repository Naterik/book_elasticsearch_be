import { z } from "zod";

export const Fine = z.object({
  id: z.number().positive(),
  amount: z.number().positive({ message: "Amount must be a positive number" }),
  reason: z.string().min(1, { message: "Reason cannot be empty" }),
  isPaid: z.boolean().default(false),
  loanId: z.number().positive({ message: "Loan ID must be a positive number" }),
  userId: z.number().positive({ message: "User ID must be a positive number" }),
});

export type TFine = z.infer<typeof Fine>;
