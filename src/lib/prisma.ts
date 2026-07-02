import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma Client singleton instance.
 * Prevents multiple instances of Prisma Client in development mode due to hot reloading.
 */
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
