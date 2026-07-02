import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Global Prisma Client singleton instance.
 * Prevents multiple instances of Prisma Client in development mode due to hot reloading.
 * Uses Prisma 7 PG Driver Adapter.
 */
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Load database connection URL with a fallback for build evaluation
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
