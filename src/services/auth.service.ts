import { bcryptPassword, comparePassword } from "configs/password";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { prisma } from "configs/client";
import { checkUsernameExists } from "./user.service";
import { AccessTokenPayload } from "src/types/jwt";

const loginUser = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      role: true,
    },
  });

  if (!user) {
    throw new Error("Invalid username/password!");
  }

  // Check if user is a Google user trying to login with password
  if (user.type === "GOOGLE") {
    throw new Error(
      "This account uses Google login. Please sign in with Google."
    );
  }

  const isMatchPassword = await comparePassword(password, user.password);
  if (!isMatchPassword) {
    throw new Error("Invalid password!");
  }

  const accessToken = await createJWT(+user.id);
  return {
    access_token: accessToken,
    user: {
      id: user.id,
      email: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      status: user.status,
      role: user.role.name,
      type: user.type,
    },
  };
};

const createJWT = async (userId: number) => {
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
    cardNumber: user?.cardNumber,
  };

  const token = jwt.sign(payload, secret, { expiresIn: expire });
  return token;
};

const registerUser = async (
  username: string,
  fullName: string,
  password: string
) => {
  await checkUsernameExists(username);
  const hashPassword = await bcryptPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      password: hashPassword,
      roleId: 2,
      type: "SYSTEM",
    },
  });
  return {
    id: user.id,
    email: user.username,
    fullName: user.fullName,
    type: user.type,
  };
};

const loginWithGoogle = async (email: string, profile: any) => {
  const user = await prisma.user.upsert({
    where: { username: email },
    update: {
      fullName: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      type: "GOOGLE",
      googleId: profile.id,
    },
    create: {
      googleId: profile.id,
      username: email,
      fullName: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      type: "GOOGLE",
      password: "",
      roleId: 2,
    },
    include: {
      role: true,
    },
  });

  return user;
};

export {
  loginUser as loginUserService,
  registerUser as registerUserService,
  loginWithGoogle,
  createJWT,
};
