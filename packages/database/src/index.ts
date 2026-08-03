import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client singleton (standard Next.js dev pattern — avoids
 * exhausting Postgres connections from hot-reload re-instantiating the
 * client on every module reload). CLAUDE.md: "Supabase PostgreSQL + Prisma
 * ORM." This is imported by every repository in apps/web/lib/repositories.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
