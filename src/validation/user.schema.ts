import * as z from "zod";

export const User = z.object({
  id: z.string(),
  username: z.email({
    pattern:
      /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-\.]*)[a-z0-9_+-]@([a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/i,
  }),
  password: z.string().trim().min(6),
  fullName: z.string().optional().or(z.literal("")),
  status: z.string().trim().default("ACTIVE"),
  address: z.string().min(3),
  phone: z.string().trim().min(3),
  roleId: z.string(),
});

export type TUser = z.infer<typeof User>;
