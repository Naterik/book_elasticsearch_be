import { prisma } from "configs/client";
import "dotenv/config";
const pageSize: number = Number(process.env.ITEM_PER_PAGE || 10);

const handleGetAllPublisher = async (page: number) => {
  const p = Math.max(1, Number(page || 1));
  const skip = (p - 1) * pageSize;
  return prisma.publisher.findMany({
    skip,
    take: pageSize,
    orderBy: { id: "desc" },
  });
};

const handleTotalPagesPublisher = async () => {
  const total_items = await prisma.publisher.count();
  return Math.ceil(total_items / pageSize);
};

const handleCheckPublisherName = async (name: string) => {
  if (!name?.trim()) throw new Error("Publisher name is required");
  const exists = await prisma.publisher.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Publisher name already exists!");
};

const handlePostPublisher = async (name: string, description?: string) => {
  await handleCheckPublisherName(name);
  return prisma.publisher.create({
    data: { name, description: description ?? "" },
  });
};

const handlePutPublisher = async (
  id: string,
  name: string,
  description?: string
) => {
  await handleCheckPublisherName(name);

  return prisma.publisher.update({
    where: { id: +id },
    data: {
      name,
      description: description ?? "",
    },
  });
};

const handleDeletePublisher = async (id: string) => {
  const used = await prisma.book.count({ where: { publisherId: +id } });
  if (used > 0) {
    throw new Error(
      "Cannot delete publisher: there are books referencing this publisher."
    );
  }

  return prisma.publisher.delete({ where: { id: +id } });
};

export {
  handleGetAllPublisher,
  handleTotalPagesPublisher,
  handleCheckPublisherName,
  handlePostPublisher,
  handlePutPublisher,
  handleDeletePublisher,
};
