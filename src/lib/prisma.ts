import { PrismaClient } from "@prisma/client";

// Fail fast at server startup if required env vars are missing.
// Skip during `next build` (NEXT_PHASE = 'phase-production-build') because
// env vars are injected at runtime, not at build time in Docker.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
