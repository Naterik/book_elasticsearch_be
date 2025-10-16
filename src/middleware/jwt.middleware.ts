import jwt from "jsonwebtoken";
import "dotenv/config";
import { NextFunction, Request, Response } from "express";
import { AccessTokenPayload } from "src/types/jwt";

const verifyValidJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const access_token = req.headers["authorization"]?.split(" ")[1];
    if (!access_token) {
      res.status(400).json({
        message: "Header not exist",
      });
    }
    const checkValidCookie = req.cookies.access_token;
    if (!checkValidCookie) {
      res.clearCookie("access_token");
      res.status(400).json({ message: "Unvalid cookie " });
    }
    const secret = process.env.JWT_SECRET;
    const decodeData = jwt.verify(
      checkValidCookie,
      secret
    ) as AccessTokenPayload;
    req.user = {
      id: +decodeData.sub,
      username: decodeData.username,
      fullName: decodeData.fullName,
      status: decodeData.status,
      role: decodeData.role,
      cardNumber: decodeData.cardNumber,
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
