import { ok } from "assert";
import { prisma } from "configs/client";
import { Request, Response } from "express";
import {
  handleDeleteUser,
  handleGetAllUser,
  handlePostUser,
  handlePutUser,
} from "services/user.service";
const getAllUser = async (req: Request, res: Response) => {
  try {
    const allUser = await handleGetAllUser();
    return res.status(200).json({
      data: allUser,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const postUser = async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, address, phone, role } = req.body;
    const avatar = req?.file?.filename;
    const user = await handlePostUser(
      username,
      password,
      fullName,
      address,
      phone,
      avatar,
      role
    );
    return res.status(200).json({
      data: user,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const putUser = async (req: Request, res: Response) => {
  try {
    const { username, fullName, address, phone, role, id } = req.body;
    const avatar = req?.file?.filename ?? null;
    const user = await handlePutUser(
      id,
      username,
      fullName,
      address,
      phone,
      role,
      avatar
    );
    return res.status(200).json({
      data: user,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await handleDeleteUser(id);
    return res.status(200).json({
      data: user,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

export { getAllUser, deleteUser, postUser, putUser };
