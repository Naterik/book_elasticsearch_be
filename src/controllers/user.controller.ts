import { Request, Response } from "express";
import {
  deleteUserService,
  getAllUsers,
  getUserByIdService,
  createUserService,
  updateUserService,
} from "services/user.service";
import "dotenv/config";
import { TUser, User } from "validation/user.schema";
import { fromError } from "zod-validation-error";
import { createMemberCardService } from "services/member.service";
import { sendResponse } from "src/utils";

const getAllUser = async (req: Request, res: Response) => {
  try {
    const { page } = req.query;
    let currentPage = page ? page : 1;
    if (+currentPage <= 0) currentPage = 1;
    const result = await getAllUsers(+currentPage);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await getUserByIdService(+id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message);
  }
};

const postUser = async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, address, phone, roleId } =
      req.body as TUser;
    User.omit({ id: true }).parse(req.body);
    const avatar = req?.file?.filename;
    const result = await createUserService(
      username,
      password,
      fullName,
      address,
      phone,
      avatar,
      roleId
    );
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message);
  }
};

const putUser = async (req: Request, res: Response) => {
  try {
    const { username, fullName, address, phone, roleId, id } =
      req.body as TUser;
    User.parse(req.body);
    const avatar = req?.file?.filename ?? null;
    const result = await updateUserService(
      id,
      username,
      fullName,
      address,
      phone,
      roleId,
      avatar
    );
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(
      res,
      400,
      "error",
      fromError(err).toString() || err.message);
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteUserService(id);
    return sendResponse(res, 200, "success", result);
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

const createMemberCard = async (req: Request, res: Response) => {
  try {
    const { fullName, phone, address, userId, duration, paymentRef } = req.body;
    const result = await createMemberCardService(
      fullName,
      phone,
      address,
      +userId,
      duration,
      paymentRef
    );
    return sendResponse(
      res,
      200,
      "success",
      result
    );
  } catch (err: any) {
    return sendResponse(res, 400, "error", err.message);
  }
};

export {
  getAllUser,
  deleteUser,
  postUser,
  putUser,
  createMemberCard,
  getUserById,
};

