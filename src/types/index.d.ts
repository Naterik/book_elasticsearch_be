import { DateTime } from "@elastic/elasticsearch/lib/api/types";
import { User as UserPrisma } from "@prisma/client";

declare global {
  namespace Express {
    interface User
      extends Pick<
        UserPrisma,
        "id" | "fullName" | "username" | "status" | "cardNumber"
      > {
      role: {};
    }
  }
}
export {};
