import path from "node:path";
import { PrismaClient } from "@prisma/client";

function databaseUrl() {
  const file = path.join(process.cwd(), "prisma", "dev.db");
  return `file:${file}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
