import { JwtPayload } from "jsonwebtoken";
export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  username: string;
  avatar: string;
  status: string;
  role: string;
  cardNumber: string | null;
}
