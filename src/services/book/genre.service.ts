import { prisma } from "configs/client";
import "dotenv/config";

const getGenresForDisplay = () => {
  return prisma.genre.findMany({ select: { name: true, id: true } });
};

const getAllGenres = async (currentPage: number) => {
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

const checkGenreNameExists = async (name: string) => {
  if (!name?.trim()) throw new Error("Genre name is required");
  const exists = await prisma.genre.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Genre name already exists!");
};

const createGenre = async (name: string, description: string) => {
  await checkGenreNameExists(name);
  return prisma.genre.create({
    data: { name: name.trim(), description: description ?? "" },
  });
};

const updateGenre = async (id: string, name: string, description?: string) => {
  return prisma.genre.update({
    where: { id: +id },
    data: {
      name,
      description,
    },
  });
};

const deleteGenre = async (id: string) => {
  return prisma.genre.delete({ where: { id: +id } });
};

export {
  getAllGenres,
  checkGenreNameExists,
  createGenre,
  updateGenre,
  deleteGenre as deleteGenreService,
  getGenresForDisplay,
};
