import { prisma } from "configs/client";
import { bcryptPassword, comparePassword } from "configs/password";
import jwt from "jsonwebtoken";
import "dotenv/config";
const handleGetAllUser = async () => {
  return prisma.user.findMany();
};

const handlePostUser = async (
  username: string,
  password: string,
  fullName: string,
  address: string,
  phone: string,
  avatar: string,
  role: string
) => {
  const hashPassword = await bcryptPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      password: hashPassword,
      fullName,
      address,
      phone,
      avatar,
      roleId: +role,
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
  role: string,
  avatar: string
) => {
  const user = await prisma.user.update({
    where: { id: +id },
    data: {
      username,
      fullName,
      address,
      phone,
      roleId: +role,
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

export {
  handleGetAllUser,
  handleDeleteUser,
  handlePostUser,
  handlePutUser,
  handleLoginUser,
};
