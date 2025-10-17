import { prisma } from "configs/client";
import "dotenv/config";

const handleGetAllGenreDisplay = () => {
  return prisma.genre.findMany({ select: { name: true, id: true } });
};

const handleGetAllGenre = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalGenres = await prisma.genre.count();
  const totalPages = Math.ceil(countTotalGenres / +pageSize);
  const result = await prisma.genre.findMany({
    skip,
    take: +pageSize,
    orderBy: { id: "desc" },
  });

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +pageSize,
      totalItems: countTotalGenres,
    },
  };
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
  return prisma.genre.delete({ where: { id: +id } });
};

export {
  handleGetAllGenre,
  handleCheckGenreName,
  handlePostGenre,
  handlePutGenre,
  handleDeleteGenre,
  handleGetAllGenreDisplay,
};
