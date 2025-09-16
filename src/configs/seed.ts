import { prisma } from "configs/client";
import { bcryptPassword } from "./password";
const initData = async () => {
  const countUser = await prisma.user.count();
  const countRole = await prisma.role.count();
  if (countRole === 0) {
    await prisma.role.createMany({
      data: [
        {
          name: "ADMIN",
          description: "Admin thì full quyền",
        },
        {
          name: "USER",
          description: "User thông thường",
        },
      ],
    });
  }
  if (countUser === 0) {
    const password = await bcryptPassword("123456");

    await prisma.user.create({
      data: { username: "admin@gmail.com", password: password, roleId: 1 },
    });
  }
  if (countRole !== 0 && countUser !== 0) {
    console.log("Have data already :>>");
  }
};

export default initData;
