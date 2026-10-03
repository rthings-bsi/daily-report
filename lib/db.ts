import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = process.env.DATABASE_URL;
const datasourceUrl =
  url && !url.startsWith("file:") && !url.startsWith("postgres")
    ? `file:${url}`
    : url;

// Bersihkan param khusus query-engine Prisma untuk driver pg:
// `pgbouncer=true` & `connection_limit` tidak dikenali node-postgres — pooling
// kini dikelola sendiri oleh pg.Pool di bawah.
const cleanUrl = (datasourceUrl || "")
  .replace(/[?&]pgbouncer=true/g, "")
  .replace(/[?&]connection_limit=\d+/g, "")
  .replace(/[?&]$/, "");

// Pool koneksi node-postgres — TIDAK bocor seperti session-mode query engine
// Prisma (yang menumpuk koneksi "idle in transaction" di Supabase sampai
// pool 15 habis → semua API 500 EMAXCONNSESSION).
const pool = new Pool({
  connectionString: cleanUrl || undefined,
  max: 8,                    // jangan monopoli semua slot pooler, sisakan headroom
  idleTimeoutMillis: 30_000, // koneksi idle dilepas setelah 30 detik
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

const existingPrisma = globalForPrisma.prisma;
const isStale = existingPrisma && !("roleConfig" in existingPrisma);

export const prisma =
  (existingPrisma && !isStale ? existingPrisma : undefined) ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
