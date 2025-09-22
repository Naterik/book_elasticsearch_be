import { Genre } from "validation/genre.schema";
import { prisma } from "configs/client";

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
    if (order === "desc") {
      orderClause = { price: "desc" };
    } else {
      orderClause = { price: "asc" };
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
        { shortDesc: { contains: search } },
        { detailDesc: { contains: search } },
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
  const [filter, count] = await prisma.$transaction([
    prisma.book.findMany({
      take: pageSize,
      skip,
      where: whereClause,
      orderBy: orderClause,
    }),
    prisma.book.count({ where: whereClause }),
  ]);
  console.log("filter :>> ", filter);
  const totalPages = Math.ceil(count / pageSize);
  return {
    filter,
    count,
    totalPages,
  };
};

export { handleFilterBook };
