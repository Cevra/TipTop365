import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Integration: exercises the FeatureFlag table round-trip against a real
// Postgres (proves migrations + Prisma client + DB wiring). Requires
// DATABASE_URL. Run with `npm run test:integration`.
const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('FeatureFlag persistence', () => {
  const key = `__it_${Math.floor(Date.now() % 1e9)}`;

  it('upserts and reads back a flag', async () => {
    await prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled: true },
      update: { enabled: true },
    });
    const row = await prisma.featureFlag.findUnique({ where: { key } });
    expect(row?.enabled).toBe(true);

    await prisma.featureFlag.update({ where: { key }, data: { enabled: false } });
    const updated = await prisma.featureFlag.findUnique({ where: { key } });
    expect(updated?.enabled).toBe(false);

    await prisma.featureFlag.delete({ where: { key } });
    expect(await prisma.featureFlag.findUnique({ where: { key } })).toBeNull();
  });

  it('has the launch flags seeded', async () => {
    const seeded = await prisma.featureFlag.findMany({
      where: { key: { in: ['ALLOW_UNVERIFIED_BOOKINGS', 'CASH_PAYMENTS_ENABLED'] } },
    });
    expect(seeded.length).toBe(2);
  });
});
