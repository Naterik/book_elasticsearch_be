import { prisma } from "configs/client";
import { bcryptPassword } from "configs/password";

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

export { handleGetAllUser, handleDeleteUser, handlePostUser, handlePutUser };
