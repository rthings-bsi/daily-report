import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = process.env.DATABASE_URL;
const datasourceUrl =
  url && !url.startsWith("file:") && !url.startsWith("postgres")
    ? `file:${url}`
    : url;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl,
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

