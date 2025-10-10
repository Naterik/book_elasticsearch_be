import { Request, Response } from "express";
import {
  handleDeleteUser,
  handleGetAllUser,
  handlePostUser,
  handlePutUser,
  handleTotalPages,
} from "services/user.service";
import "dotenv/config";
import { TUser, User } from "validation/user.schema";
import { fromError } from "zod-validation-error";
import { handleCreateMemberCard } from "services/member.services";
const getAllUser = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage = page ? page : 1;
    if (+currentPage <= 0) currentPage = 1;
    const allUser = await handleGetAllUser(+currentPage);
    const totalPage = await handleTotalPages();
    res.status(200).json({
      data: allUser,
      totalPage,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const postUser = async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, address, phone, roleId } =
      req.body as TUser;
    User.omit({ id: true }).parse(req.body);
    const avatar = req?.file?.filename;
    const result = await handlePostUser(
      username,
      password,
      fullName,
      address,
      phone,
      avatar,
      roleId
    );
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

const putUser = async (req: Request, res: Response) => {
  try {
    const { username, fullName, address, phone, roleId, id } =
      req.body as TUser;
    User.parse(req.body);
    const avatar = req?.file?.filename ?? null;
    const result = await handlePutUser(
      id,
      username,
      fullName,
      address,
      phone,
      roleId,
      avatar
    );
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: fromError(err).toString(),
      data: null,
    });
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await handleDeleteUser(id);
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

const createMemberCard = async (req: Request, res: Response) => {
  try {
    const { fullName, phone, address, userId, duration, paymentRef } = req.body;
    const result = await handleCreateMemberCard(
      fullName,
      phone,
      address,
      +userId,
      duration,
      paymentRef
    );
    res.status(200).json({
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
      data: null,
    });
  }
};

export { getAllUser, deleteUser, postUser, putUser, createMemberCard };
