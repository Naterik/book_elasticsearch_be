import * as z from "zod";

export const Auth = z
  .object({
    username: z.email({
      pattern:
        /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-\.]*)[a-z0-9_+-]@([a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/i,
    }),
    password: z.string().trim().min(6),
    confirmPassword: z.string().trim().min(6),
    fullName: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type TAuth = z.infer<typeof Auth>;
