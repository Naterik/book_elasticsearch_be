import { bcryptPassword, comparePassword } from "configs/password";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { prisma } from "configs/client";
import { handleCheckUsername } from "./user.service";
import { AccessTokenPayload } from "src/types/jwt";

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
  const accessToken = await handleCreateJWT(+user.id);
  return {
    access_token: accessToken,
    user: {
      id: user.id,
      email: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      status: user.status,
      role: user.role.name,
    },
  };
};

const handleCreateJWT = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
    },
  });
  if (!user) throw new Error("User not found");
  const secret = process.env.JWT_SECRET;
  const expire: any = process.env.JWT_EXPIRE;
  const payload: AccessTokenPayload = {
    sub: String(user.id),
    username: user.username,
    fullName: user?.fullName,
    avatar: user?.avatar,
    role: user?.role.name,
    status: user?.status,
  };
  const token = jwt.sign(payload, secret, { expiresIn: expire });

  return token;
};

const handleRegisterUser = async (
  username: string,
  fullName: string,
  password: string
) => {
  await handleCheckUsername(username);
  const hashPassword = await bcryptPassword(password);
  const user = await prisma.user.create({
    data: { username, fullName, password: hashPassword, roleId: 2 },
  });
  return {
    id: user.id,
    email: user.username,
    fullName: user.fullName,
  };
};

const handleLoginWithGoogle = async (data) => {
  const { username, fullName, avatar, type, googleId } = data;
  const user = await prisma.user.upsert({
    where: {
      googleId,
    },
    update: { username, fullName, avatar, roleId: 2 },
    create: {
      googleId,
      username,
      fullName,
      avatar,
      type,
      password: "",
      role: { connect: { id: 2 } },
    },
    include: {
      role: true,
    },
  });
  return user;
};

export {
  handleLoginUser,
  handleRegisterUser,
  handleLoginWithGoogle,
  handleCreateJWT,
};
