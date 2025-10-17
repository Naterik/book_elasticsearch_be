import { prisma } from "configs/client";
import "dotenv/config";

const handleGetAllAuthor = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalAuthors = await prisma.author.count();
  const totalPages = Math.ceil(countTotalAuthors / +pageSize);
  const result = await prisma.author.findMany({
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
      totalItems: countTotalAuthors,
    },
  };
};

const handleCheckAuthorName = async (name: string) => {
  if (!name?.trim()) throw new Error("Author name is required");
  const exists = await prisma.author.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Author name already exists!");
};

const handlePostAuthor = async (name: string, bio?: string) => {
  await handleCheckAuthorName(name);
  return prisma.author.create({
    data: { name, bio: bio ?? null },
  });
};

const handlePutAuthor = async (id: string, name: string, bio?: string) => {
  if (name) {
    await handleCheckAuthorName(name);
  }

  return prisma.author.update({
    where: { id: +id },
    data: {
      name,
      bio: bio ?? null,
    },
  });
};

const handleDeleteAuthor = async (id: string) => {
  const used = await prisma.book.count({ where: { authorId: +id } });
  if (used > 0) {
    throw new Error(
      "Cannot delete author: there are books referencing this author."
    );
  }

  return prisma.author.delete({ where: { id: +id } });
};

const handleCreateManyAuthors = async (
  authors: { name: string; bio?: string }[]
) => {
  const createAuthors = await prisma.author.createMany({
    data: authors,
    skipDuplicates: true,
  });
  return createAuthors;
};

export {
  handleGetAllAuthor,
  handlePostAuthor,
  handlePutAuthor,
  handleDeleteAuthor,
  handleCreateManyAuthors,
};
