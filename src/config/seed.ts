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
    const password = await bcryptPassword("123456789");

    await prisma.user.createMany({
      data: [
        {
          username: "admin@gmail.com",
          password: password,
          fullName: "John Doe",
          address: "123 Main St, Hanoi",
          phone: "0901234567",
          avatar: "https://example.com/avatar/john.png",
          type: "SYSTEM",
          cardNumber: "CARD123456",
          membershipStart: new Date("2025-01-01"),
          membershipEnd: new Date("2100-12-31"),
          status: "ACTIVE",
          createdAt: new Date("2025-01-01T08:00:00Z"),
          updatedAt: new Date("2100-11-30T12:00:00Z"),
          roleId: 1,
        },
        {
          username: "khuong@gmail.com",
          password: password,
          fullName: "Jane Smith",
          address: "456 Nguyen Trai, Hanoi",
          phone: "0912345678",
          avatar: "https://example.com/avatar/jane.png",
          type: "SYSTEM",
          status: "PENDING_CARD",
          createdAt: new Date("2025-03-15T09:30:00Z"),
          updatedAt: new Date("2100-11-30T12:00:00Z"),
          roleId: 1,
        },
        {
          username: "user@gmail.com",
          password: password,
          fullName: "Admin User",
          address: "789 Le Loi, Hanoi",
          phone: "0987654321",
          avatar: "https://example.com/avatar/admin.png",
          type: "SYSTEM",
          cardNumber: "CARD789012",
          membershipStart: new Date("2025-06-01"),
          membershipEnd: new Date("2026-05-31"),
          status: "SUSPENDED",
          createdAt: new Date("2025-06-01T10:15:00Z"),
          updatedAt: new Date("2025-11-30T12:00:00Z"),
          roleId: 2,
        },
      ],
    });
  }
  if (countRole !== 0 && countUser !== 0) {
    console.log("Has data already :>>");
  }
};

export default initData;
