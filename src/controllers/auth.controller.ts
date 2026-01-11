import { Request, Response } from "express";
import { Auth, TAuth } from "validation/auth.schema";
import { fromError } from "zod-validation-error";
import {
  createJWT,
  loginUserService,
  registerUserService,
} from "services/auth.service";
import { sendResponse } from "src/utils";

const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as TAuth;
    Auth.omit({
      confirmPassword: true,
      fullName: true,
    }).parse(req.body);
    const checkLogin = await loginUserService(username, password);

    res.cookie("access_token", checkLogin.access_token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendResponse(res, 200, "success", checkLogin);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message);
  }
};

const registerUser = async (req: Request, res: Response) => {
  console.log("Request reached /register!");
  try {
    const { username, fullName, password, confirmPassword } = req.body as TAuth;
    Auth.parse(req.body);
    const checkRegister = await registerUserService(
      username,
      fullName,
      password
    );
    return sendResponse(
      res,
      200,
      "success",
      checkRegister
    );
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message);
  }
};

const fetchAccount = (req: Request, res: Response) => {
  try {
    const { user } = req;
    return sendResponse(res, 200, "success", user);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      "Fetch error " + (fromError(err).toString() || err.message));
  }
};

const logoutUser = (req: Request, res: Response) => {
  try {
    res.clearCookie("access_token");
    return sendResponse(res, 200, "success");
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";

const googleAccessToken = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const getToken = await createJWT(user.id);
    res.cookie("access_token", getToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    console.log("âœ… Google OAuth Success:", {
      userId: user.id,
      email: user.username,
    });
    res.redirect(
      `${frontendURL}/auth/callback?token=${getToken}&user=${encodeURIComponent(
        JSON.stringify({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          type: user.type,
        })
      )}`
    );
  } catch (err) {
    res.redirect(`${frontendURL}/login?error=auth_failed`);
  }
};

export { loginUser, registerUser, googleAccessToken, fetchAccount, logoutUser };

