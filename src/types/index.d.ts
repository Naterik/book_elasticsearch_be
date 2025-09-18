import { User as UserPrisma } from "@prisma/client";
declare global {
  namespace Express {
    interface User
      extends Pick<
        UserPrisma,
        | "id"
        | "fullName"
        | "username"
        | "membershipStart"
        | "membershipEnd"
        | "googleId"
        | "roleId"
      > {}
  }
}
