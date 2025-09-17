import { Request, Response } from "express";
import { handleLoginUser } from "services/user.service";
const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const checkLogin = await handleLoginUser(username, password);
    return res.status(200).json({
      data: checkLogin,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

export { loginUser };
