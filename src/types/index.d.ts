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
  interface INotificationPayload {
    userId: number;
    type: "LOAN" | "RESERVATION" | "FINE" | "PAYMENT" | "SYSTEM";
    title: string;
    content: string;
    priority?: "HIGH" | "NORMAL" | "LOW";
    relatedId?: number;
  }
}
export {};
