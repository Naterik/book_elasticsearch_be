import { prisma } from "configs/client";
import "dotenv/config";
const pageSize: number = Number(process.env.ITEM_PER_PAGE || 10);

const handleGetAllAuthor = async (page: number) => {
  const p = Math.max(1, Number(page || 1));
  const skip = (p - 1) * pageSize;
  return prisma.author.findMany({
    skip,
    take: pageSize,
  });
};

const handleTotalPagesAuthor = async () => {
  const total_items = await prisma.author.count();
  return Math.ceil(total_items / pageSize);
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
  await handleCheckAuthorName(name);

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
  handleTotalPagesAuthor,
  handleCheckAuthorName,
  handlePostAuthor,
  handlePutAuthor,
  handleDeleteAuthor,
  handleCreateManyAuthors,
};
