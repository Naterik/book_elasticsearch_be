import { prisma } from "configs/client";
import "dotenv/config";

const getAllPublishers = async (currentPage: number, name?: string) => {
  const pageSize = process.env.ITEM_PER_PAGE || 10;
  const skip = (currentPage - 1) * +pageSize;
  
  const where = {
    name: {
      contains: name || "",
    },
  };

  const countTotalPublishers = await prisma.publisher.count({ where });
  const totalPages = Math.ceil(countTotalPublishers / +pageSize);
  const result = await prisma.publisher.findMany({
    skip,
    take: +pageSize,
    orderBy: { id: "desc" },
    where,
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

const checkPublisherNameExists = async (name: string) => {
  if (!name?.trim()) throw new Error("Publisher name is required");
  const exists = await prisma.publisher.findFirst({
    where: { name },
    select: { id: true },
  });
  if (exists) throw new Error("Publisher name already exists!");
};

const createPublisher = async (name: string, description?: string) => {
  await checkPublisherNameExists(name);
  return prisma.publisher.create({
    data: { name, description: description ?? "" },
  });
};

const updatePublisher = async (
  id: string,
  name: string,
  description?: string
) => {
  await checkPublisherNameExists(name);

  return prisma.publisher.update({
    where: { id: +id },
    data: {
      name,
      description: description ?? "",
    },
  });
};

const deletePublisherService = async (id: string) => {
  const used = await prisma.book.count({ where: { publisherId: +id } });
  if (used > 0) {
    throw new Error(
      "Cannot delete publisher: there are books referencing this publisher."
    );
  }

  return prisma.publisher.delete({ where: { id: +id } });
};

const getPublisherByIdService = async (id: number) => {
  return prisma.publisher.findUnique({
    where: { id },
    include: {
      books: true,
    },
  });
};

const getAllPublishersNoPagination = async () => {
  return prisma.publisher.findMany({
    orderBy: { name: "asc" },
  });
};

export {
  getAllPublishers,
  checkPublisherNameExists,
  createPublisher,
  updatePublisher,
  deletePublisherService,
  getPublisherByIdService,
  getAllPublishersNoPagination,
  performFullPublisherCleanup,
};

/**
 * Validate publisher name
 */
const isValidPublisher = (name: string): boolean => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) return false;

  const invalidPatterns = [
    /^\[.*\]$/, 
    /^\(.*\)$/,
    /http[s]?:\/\//,
    /^\d+$/, // Only numbers (publishers might have numbers but rarely JUST numbers)
    /unknown/i,
    /anonymous/i
  ];
  if (invalidPatterns.some(p => p.test(trimmedName))) return false;
  return true;
};

const cleanupOrphanPublishers = async () => {
  try {
    const all = await prisma.publisher.findMany({
      select: { id: true, _count: { select: { books: true } } }
    });
    const orphans = all.filter(p => p._count.books === 0).map(p => p.id);
    if (orphans.length === 0) return { deletedCount: 0 };
    
    const res = await prisma.publisher.deleteMany({ where: { id: { in: orphans } } });
    return { deletedCount: res.count };
  } catch (e: any) {
     throw new Error(e.message);
  }
};

const cleanupInvalidPublishers = async () => {
   try {
     const all = await prisma.publisher.findMany({ select: { id: true, name: true }});
     const invalid = all.filter(p => !isValidPublisher(p.name)).map(p => p.id);
     
     // Check usage
     const used = await prisma.book.findMany({ where: { publisherId: { in: invalid }}, select: { publisherId: true }, distinct: ['publisherId']});
     const usedSet = new Set(used.map(b => b.publisherId));
     
     const toDelete = invalid.filter(id => !usedSet.has(id));
     if (toDelete.length === 0) return { deletedCount: 0 };
     
     const res = await prisma.publisher.deleteMany({ where: { id: { in: toDelete } } });
     return { deletedCount: res.count };
   } catch(e: any) {
     throw new Error(e.message);
   }
};

const cleanupDuplicatePublishers = async () => {
  try {
     const all = await prisma.publisher.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' }});
     const map = new Map<string, number[]>();
     all.forEach(p => {
       const norm = p.name.toLowerCase().trim().replace(/\s+/g, " ");
       if (!map.has(norm)) map.set(norm, []);
       map.get(norm)!.push(p.id);
     });
     
     const dups = Array.from(map.values()).filter(ids => ids.length > 1);
     let deleted = 0;
     let merged = 0;
     
     await prisma.$transaction(async tx => {
       for (const ids of dups) {
         const keep = ids[0];
         const remove = ids.slice(1);
         
         const upd = await tx.book.updateMany({
           where: { publisherId: { in: remove } },
           data: { publisherId: keep }
         });
         merged += upd.count;
         
         const del = await tx.publisher.deleteMany({
           where: { id: { in: remove } }
         });
         deleted += del.count;
       }
     });
     return { deletedCount: deleted, mergedCount: merged, duplicateGroups: dups.length };
  } catch(e:any) {
    throw new Error(e.message);
  }
};

const normalizePublisherNames = async () => {
   try {
     const all = await prisma.publisher.findMany({ select: { id: true, name: true }});
     let count = 0;
     for (const p of all) {
       const norm = p.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ").trim();
       if (norm !== p.name && isValidPublisher(norm)) {
          const exists = await prisma.publisher.count({ where: { name: norm }});
          if (exists === 0) {
            await prisma.publisher.update({ where: { id: p.id }, data: { name: norm }});
            count++;
          }
       }
     }
     return { updatedCount: count };
   } catch(e:any) {
     throw new Error(e.message);
   }
};

const performFullPublisherCleanup = async () => {
   console.log("Starting Publisher Cleanup...");
   const orphan = await cleanupOrphanPublishers();
   const invalid = await cleanupInvalidPublishers();
   const duplicates = await cleanupDuplicatePublishers();
   const normalized = await normalizePublisherNames();
   
   return {
     orphan, invalid, duplicates, normalized, success: true
   };
};
