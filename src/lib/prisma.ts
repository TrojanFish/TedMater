import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Final Safety Net: Hard-inject environment variables for Prisma 7 + Next 16 Turbopack
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:./dev.db";
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "TEDMASTER-SUPER-SECRET-123";

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
