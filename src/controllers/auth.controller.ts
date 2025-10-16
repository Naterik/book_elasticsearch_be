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

    res.cookie("access_token", checkLogin.access_token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
  console.log("Request reached /register!");
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

const fetchAccount = (req: Request, res: Response) => {
  try {
    const { user } = req;
    res.status(200).json({
      data: user,
    });
  } catch (err) {
    res.status(400).json({
      message: "Fetch error" + fromError(err).toString(),
      data: null,
    });
  }
};

const logoutUser = (req: Request, res: Response) => {
  try {
    res.clearCookie("access_token");
    res.status(200).json({
      message: "Logout successful",
      data: null,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";

const googleAccessToken = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const getToken = await handleCreateJWT(user.id);
    res.cookie("access_token", getToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    console.log("✅ Google OAuth Success:", {
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
