// Seed the launch feature flags idempotently (E0.5). The full seed is E1.6.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const flags = [
  { key: 'ALLOW_UNVERIFIED_BOOKINGS', enabled: true },
  { key: 'CASH_PAYMENTS_ENABLED', enabled: true },
];
try {
  for (const f of flags) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, create: f, update: {} });
  }
  const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  console.log('feature_flags seeded:', rows.map((r) => `${r.key}=${r.enabled}`).join(', '));
} finally {
  await prisma.$disconnect();
}
