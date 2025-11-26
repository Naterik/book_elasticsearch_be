import { prisma } from "configs/client";
import { title } from "node:process";
const filterBooks = async (
  page: number,
  priceRange: string[],
  search: string,
  genres: string,
  order: string,
  yearRange: string[],
  language: string
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
  if (priceRange) {
    const number = priceRange?.map((p) => +p);
    whereClause = {
      ...whereClause,
      price: {
        gte: number[0],
        lte: number[1],
      },
    };
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

  if (language) {
    whereClause = {
      ...whereClause,
      language: {
        contains: language,
      },
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
  if (yearRange) {
    whereClause = {
      ...whereClause,
      publishDate: {
        gte: new Date(`${+yearRange[0]}-01-01`),
        lte: new Date(`${+yearRange[1]}-12-31`),
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
      include: {
        authors: { select: { name: true } },
        genres: { select: { genres: { select: { id: true, name: true } } } },
        publishers: { select: { name: true } },
      },
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

export { filterBooks };
