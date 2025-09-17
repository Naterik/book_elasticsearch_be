import { Request, Response } from "express";
import { handleLoginUser, handleRegisterUser } from "services/user.service";
import { Auth, TAuth } from "validation/auth.schema";
import { fromError } from "zod-validation-error";

const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as TAuth;
    const validate = Auth.omit({
      confirmPassword: true,
      fullName: true,
    }).parse(req.body);
    const checkLogin = await handleLoginUser(username, password);
    return res.status(200).json({
      data: checkLogin,
    });
  } catch (err) {
    return res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, fullName, password, confirmPassword } = req.body as TAuth;
    const validate = Auth.parse(req.body);
    console.log("validate :>> ", validate);
    const checkRegister = await handleRegisterUser(
      username,
      fullName,
      password
    );
    res.status(200).json({
      data: checkRegister,
    });
  } catch (err) {
    return res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

export { loginUser, registerUser };
