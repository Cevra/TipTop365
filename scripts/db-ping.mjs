// Connectivity smoke test: `npm run db:ping`
// Proves DATABASE_URL (pooled, Neon) accepts queries. Used by gate G0/G1 checks.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const [row] = await prisma.$queryRaw`SELECT 1 AS ok, current_database() AS db, version() AS pg`;
  console.log(`db:ping OK — database=${row.db}, ${String(row.pg).split(',')[0]}`);
} catch (err) {
  console.error('db:ping FAILED —', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
