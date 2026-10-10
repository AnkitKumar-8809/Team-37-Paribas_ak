/**
 * Database setup & connectivity verification script.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[setupDatabase] Verifying database connectivity...');
  try {
    await prisma.$connect();
    console.log('[setupDatabase] Successfully connected to PostgreSQL database via Prisma.');
  } catch (error) {
    console.error('[setupDatabase] Database connection error:', error);
    console.log('[setupDatabase] Ensure PostgreSQL is running (e.g. docker-compose up -d postgres).');
  } finally {
    await prisma.$disconnect();
  }
}

main();
