import { Request, Response } from "express";
import { Auth, TAuth } from "validation/auth.schema";
import { fromError } from "zod-validation-error";
import {
  handleCreateJWT,
  handleLoginUser,
  handleRegisterUser,
} from "services/auth.services";

const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as TAuth;
    Auth.omit({
      confirmPassword: true,
      fullName: true,
    }).parse(req.body);
    const checkLogin = await handleLoginUser(username, password);
    res.status(200).json({
      data: checkLogin,
    });
  } catch (err) {
    res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, fullName, password, confirmPassword } = req.body as TAuth;
    Auth.parse(req.body);
    const checkRegister = await handleRegisterUser(
      username,
      fullName,
      password
    );
    res.status(200).json({
      data: checkRegister,
    });
  } catch (err) {
    res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

const googleAccessToken = async (req: Request, res: Response) => {
  try {
    const { id } = req.user as any;
    const getToken = await handleCreateJWT(id);
    console.log("getToekn :>> ", getToken);
    res.status(200).json({
      data: getToken,
    });
  } catch (err) {
    res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

export { loginUser, registerUser, googleAccessToken };
