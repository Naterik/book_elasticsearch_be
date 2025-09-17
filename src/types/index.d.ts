import { user as UserPrisma } from "@prisma/client";
declare global {
  namespace Express {
    interface User
      extends Pick<
        UserPrisma,
        "id" | "fullName" | "username" | "membershipStart" | "membershipEnd"
      > {
      role: string;
    }
  }
}
