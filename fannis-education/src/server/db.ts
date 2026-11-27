import type { Prisma, PrismaClient } from "@prisma/client";

/** Client utilisable hors ou dans une transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;
