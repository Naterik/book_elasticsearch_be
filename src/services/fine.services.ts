// src/services/fined/fined.services.ts

import { prisma } from "configs/client";
import "dotenv/config";
const handleGetAllFines = async (currentPage: number) => {
  const limit = +process.env.ITEM_PER_PAGE;
  const offset = (currentPage - 1) * limit;

  const result = await prisma.fine.findMany({
    skip: offset,
    take: limit,
    include: {
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
      loan: true,
    },
  });

  const totalFines = await prisma.fine.count();
  const totalPages = Math.ceil(totalFines / limit);

  return {
    result,
    pagination: {
      currentPage,
      totalPages,
      pageSize: +limit,
      totalItems: totalFines,
    },
  };
};

const handleGetFinedById = async (id: number) => {
  const fine = await prisma.fine.findMany({
    where: { loanId: id },
    include: {
      user: {
        omit: {
          password: true,
          googleId: true,
          type: true,
        },
      },
      loan: true,
    },
  });
  return fine;
};

const handlePostFined = async (
  amount: number,
  reason: string,
  isPaid: boolean,
  loanId: number,
  userId: number
) => {
  const newFine = await prisma.fine.create({
    data: {
      amount,
      reason,
      isPaid,
      loanId,
      userId,
    },
  });
  return newFine;
};

const handlePutFined = async (
  id: number,
  amount: number,
  reason: string,
  isPaid: boolean,
  loanId: number,
  userId: number
) => {
  const updatedFine = await prisma.fine.update({
    where: { id },
    data: {
      amount,
      reason,
      isPaid,
      loanId,
      userId,
    },
  });
  return updatedFine;
};

const handleDeleteFined = async (id: number) => {
  const deletedFine = await prisma.fine.delete({
    where: { id },
  });
  return deletedFine;
};

export {
  handleGetAllFines,
  handleGetFinedById,
  handlePostFined,
  handlePutFined,
  handleDeleteFined,
};
