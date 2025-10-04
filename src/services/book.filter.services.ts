import { prisma } from "configs/client";
import { title } from "node:process";
const handleFilterBook = async (
  page: number,
  minPrice: number,
  maxPrice: number,
  search: string,
  genres: string,
  order: string
) => {
  let whereClause = {};
  let orderClause = {};
  if (order) {
    if (order === "newest") {
      orderClause = { publishDate: "desc" };
    }
    if (order === "oldest") {
      orderClause = { publishDate: "asc" };
    }
    if (order === "title") {
      orderClause = { title: "asc" };
    }
  }
  if (minPrice || maxPrice) {
    if (minPrice) {
      whereClause = { price: { gte: minPrice } };
    }
    if (maxPrice) {
      whereClause = {
        price: { lte: maxPrice },
      };
    }
    if (minPrice && maxPrice) {
      whereClause = {
        price: { gte: minPrice, lte: maxPrice },
      };
    }
  }
  if (search) {
    whereClause = {
      ...whereClause,
      OR: [
        { title: { contains: search } },
        { detailDesc: { contains: search } },
        { authors: { is: { name: { contains: search } } } },
      ],
    };
  }

  if (genres) {
    const genreNames = genres.split(",");
    whereClause = {
      ...whereClause,
      genres: {
        some: {
          genres: {
            name: { in: genreNames },
          },
        },
      },
    };
  }
  const pageSize = +process.env.ITEM_PER_PAGE;
  const skip = (page - 1) * pageSize;
  const [result, count] = await prisma.$transaction([
    prisma.book.findMany({
      take: pageSize,
      skip,
      where: whereClause,
      orderBy: orderClause,
    }),
    prisma.book.count({ where: whereClause }),
  ]);
  if (!result.length) {
    throw new Error("No search results found !");
  }
  const totalPages = Math.ceil(count / pageSize);
  return {
    result,
    pagination: {
      currentPage: page,
      totalPages,
      pageSize: +pageSize,
      totalItems: count,
    },
  };
};

export { handleFilterBook };
