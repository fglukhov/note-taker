import { PrismaClient } from '@/src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg'; // ➕ новое
import { Pool } from 'pg'; // ➕ новое

const pool = new Pool({
  // ➕ новое
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool); // ➕ новое

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // ❗ изменено
    adapter, // ❗ добавлено
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
