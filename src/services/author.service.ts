import { prisma } from "configs/client";

const handleGetAllAuthor = async () => {
  return await prisma.author.findMany();
};

export { handleGetAllAuthor };
