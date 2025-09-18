import { prisma } from "configs/client";
import { bcryptPassword } from "configs/password";

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
  handleTotalPages,
  handleCheckUsername,
};
