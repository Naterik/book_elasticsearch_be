import { prisma } from "configs/client";
import "dotenv/config";
const pageSize: number = Number(process.env.ITEM_PER_PAGE || 10);

const handleGetAllGenre = async (page: number) => {
  const p = Math.max(1, Number(page || 1));
  const skip = (p - 1) * pageSize;
  return prisma.genre.findMany({
    skip,
    take: pageSize,
    orderBy: { id: "desc" },
  });
};

const handleTotalPagesGenre = async () => {
  const total_items = await prisma.genre.count();
  return Math.ceil(total_items / pageSize);
};

const handleCheckGenreName = async (name: string) => {
  if (!name?.trim()) throw new Error("Genre name is required");
  const exists = await prisma.genre.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Genre name already exists!");
};

const handlePostGenre = async (name: string, description: string) => {
  await handleCheckGenreName(name);
  return prisma.genre.create({
    data: { name: name.trim(), description: description ?? "" },
  });
};

const handlePutGenre = async (
  id: string,
  name: string,
  description?: string
) => {
  return prisma.genre.update({
    where: { id: +id },
    data: {
      name,
      description,
    },
  });
};

const handleDeleteGenre = async (id: string) => {
  const used = await prisma.book.count({
    where: { genres: { some: { id: +id } } },
  });
  if (used > 0) {
    throw new Error(
      "Cannot delete genre: there are books linked to this genre."
    );
  }

  return prisma.genre.delete({ where: { id: +id } });
};

export {
  handleGetAllGenre,
  handleTotalPagesGenre,
  handleCheckGenreName,
  handlePostGenre,
  handlePutGenre,
  handleDeleteGenre,
};
