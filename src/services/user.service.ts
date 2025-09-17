import { prisma } from "configs/client";
import { bcryptPassword, comparePassword } from "configs/password";
import jwt from "jsonwebtoken";
import "dotenv/config";
const pageSize: number = +process.env.ITEM_PER_PAGE;
const handleGetAllUser = async (page: number) => {
  const skip = (page - 1) * pageSize;
  const paginate = prisma.user.findMany({
    skip: skip,
    take: pageSize,
  });
  return paginate;
};

const handleTotalPages = async () => {
  const total_items = await prisma.user.count();
  const totalPage = Math.ceil(total_items / pageSize);
  return totalPage;
};

const handlePostUser = async (
  username: string,
  password: string,
  fullName: string,
  address: string,
  phone: string,
  avatar: string,
  roleId: string
) => {
  const checkUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (checkUsername) {
    throw new Error("Username already exist !");
  }
  const hashPassword = await bcryptPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      password: hashPassword,
      fullName,
      address,
      phone,
      avatar,
      roleId: +roleId,
    },
  });
  return user;
};

const handlePutUser = async (
  id: string,
  username: string,
  fullName: string,
  address: string,
  phone: string,
  roleId: string,
  avatar: string
) => {
  const user = await prisma.user.update({
    where: { id: +id },
    data: {
      username,
      fullName,
      address,
      phone,
      roleId: +roleId,
      ...(avatar !== undefined && { avatar: avatar }),
    },
  });
  return user;
};

const handleDeleteUser = async (id: string) => {
  const deleteUser = await prisma.user.delete({
    where: {
      id: +id,
    },
  });
  return deleteUser;
};

const handleLoginUser = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      role: true,
    },
  });
  if (!user) {
    throw new Error("Invalid username/password!");
  }
  const isMatchPassword = await comparePassword(password, user.password);
  if (!isMatchPassword) {
    throw new Error("Invalid password!");
  }
  const secret = process.env.JWT_SECRET;
  const expire: any = process.env.JWT_EXPIRE;
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role.name,
    fullName: user?.fullName,
    membershipStart: user?.membershipStart,
    membershipEnd: user?.membershipEnd,
  };
  const token = jwt.sign(payload, secret, { expiresIn: expire });
  return token;
};

const handleRegisterUser = async (
  username: string,
  fullName: string,
  password: string
) => {
  const checkUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (!checkUsername.username) {
    throw new Error("Username already exist !");
  }
  const hashPassword = await bcryptPassword(password);
  const user = await prisma.user.create({
    data: { username, fullName, password: hashPassword, roleId: 2 },
  });
  return user;
};

export {
  handleGetAllUser,
  handleDeleteUser,
  handlePostUser,
  handlePutUser,
  handleLoginUser,
  handleRegisterUser,
  handleTotalPages,
};
