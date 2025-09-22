import jwt from "jsonwebtoken";
import "dotenv/config";
import { NextFunction, Request, Response } from "express";
import { AccessTokenPayload } from "src/types/jwt";

const verifyValidJWT = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  const whiteLists = ["/login", "/register", "/auth/google"];
  const isWhiteList = whiteLists.some((route) => route === path);
  if (isWhiteList) {
    next();
    return;
  }

  try {
    const access_token = req.headers["authorization"]?.split(" ")[1];
    if (!access_token) {
      res.status(400).json({
        message: "Header not exist",
      });
    }
    const secret = process.env.JWT_SECRET;
    const decodeData = jwt.verify(access_token, secret) as AccessTokenPayload;
    req.user = {
      id: +decodeData.id,
      username: decodeData.username,
      fullName: decodeData.fullName,
      membershipStart: decodeData.membershipStart,
      membershipEnd: decodeData.membershipEnd,
      role: decodeData.role,
    };

    next();
  } catch (err) {
    console.log("err.message :>> ", err.message);
    res.status(400).json({
      data: null,
      message: "Invalid Jwt token",
    });
  }
};
export default verifyValidJWT;
