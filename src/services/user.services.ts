import { prisma } from "configs/client";
import { bcryptPassword } from "configs/password";

const pageSize: number = +process.env.ITEM_PER_PAGE;
const handleGetAllUser = async (page: number) => {
  const skip = (page - 1) * pageSize;
  const total_items = await prisma.user.count();
  const totalPages = Math.ceil(total_items / pageSize);
  const result = await prisma.user.findMany({
    skip: skip,
    take: pageSize,
    include: { role: { select: { name: true } } },
  });
  return {
    result,
    pagination: {
      currentPage: page,
      totalPages,
      pageSize,
      totalItems: total_items,
    },
  };
};

const handleGetUserById = async (id: number) => {
  return prisma.user.findUnique({
    where: { id },
  });
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
  const hashPassword = await bcryptPassword(password);
  const result = await prisma.user.create({
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
  return result;
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
  const result = await prisma.user.update({
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
  return result;
};

const handleDeleteUser = async (id: string) => {
  const result = await prisma.user.delete({
    where: {
      id: +id,
    },
  });
  return result;
};

const handleCheckUsername = async (username: string) => {
  const checkUsername = await prisma.user.findUnique({
    where: { username },
    select: { username: true },
  });
  if (checkUsername) {
    throw new Error("Username already exist !");
  }
};

export {
  handleGetAllUser,
  handleDeleteUser,
  handlePostUser,
  handlePutUser,
  handleGetUserById,
  handleCheckUsername,
};
