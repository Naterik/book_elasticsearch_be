import { prisma } from "configs/client";
import "dotenv/config";

const handleGetAllPublisher = async (currentPage: number) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  const countTotalPublishers = await prisma.publisher.count();
  const totalPages = Math.ceil(countTotalPublishers / +pageSize);
  const result = await prisma.publisher.findMany({
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
      totalItems: countTotalPublishers,
    },
  };
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
  handleCheckPublisherName,
  handlePostPublisher,
  handlePutPublisher,
  handleDeletePublisher,
};
