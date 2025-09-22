import { JwtPayload } from "jsonwebtoken";
export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  username: string;
  membershipStart: Date | null;
  membershipEnd: Date | null;
  role: string;
}
