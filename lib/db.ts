import { PrismaClient } from "@prisma/client";
import { join } from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbPath = join(process.cwd(), "prisma/dev.db");
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: `file:${dbPath}`
} as any);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
