import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Integration: round-trips the E1.2 catalog block against real Postgres —
// service_types, addons, pricing_configs (versioned), and the cleaner_services
// join deferred from E1.1. Requires DATABASE_URL (npm run test:integration).
const prisma = new PrismaClient();

const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  await prisma.cleanerService.deleteMany({ where: { serviceType: { key: { contains: stamp } } } });
  await prisma.pricingConfig.deleteMany({ where: { city: { slug: { contains: stamp } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.serviceType.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.addon.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.city.deleteMany({ where: { slug: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('catalog block round-trip', () => {
  it('creates service types and addons with catalog defaults', async () => {
    const standard = await prisma.serviceType.create({
      data: {
        key: `standard-${stamp}`,
        nameBs: 'Standardno čišćenje',
        nameEn: 'Standard cleaning',
        durationMultiplier: 1.0,
      },
    });
    expect(standard.requiresVerified).toBe(false);
    expect(standard.active).toBe(true);

    const airbnb = await prisma.serviceType.create({
      data: {
        key: `airbnb-${stamp}`,
        nameBs: 'Airbnb pranje',
        nameEn: 'Airbnb turnover',
        durationMultiplier: 0.9,
        requiresVerified: true,
      },
    });
    expect(airbnb.requiresVerified).toBe(true);

    const oven = await prisma.addon.create({
      data: {
        key: `oven-${stamp}`,
        nameBs: 'Rerna',
        nameEn: 'Oven interior',
        hours: 1.0,
        unit: 'fixed',
      },
    });
    expect(oven.unit).toBe('fixed');

    const windows = await prisma.addon.create({
      data: {
        key: `windows-${stamp}`,
        nameBs: 'Prozori',
        nameEn: 'Windows',
        hours: 0.25,
        unit: 'per_window',
      },
    });
    expect(windows.unit).toBe('per_window');
  });

  it('enforces unique service_type/addon keys', async () => {
    const key = `dup-${stamp}`;
    await prisma.serviceType.create({
      data: { key, nameBs: 'X', nameEn: 'X', durationMultiplier: 1.0 },
    });
    await expect(
      prisma.serviceType.create({
        data: { key, nameBs: 'Y', nameEn: 'Y', durationMultiplier: 1.5 },
      }),
    ).rejects.toThrow();
  });

  it('links a cleaner to multiple service types via cleaner_services', async () => {
    const [standard, deep] = await Promise.all([
      prisma.serviceType.create({
        data: { key: `link-standard-${stamp}`, nameBs: 'S', nameEn: 'S', durationMultiplier: 1.0 },
      }),
      prisma.serviceType.create({
        data: { key: `link-deep-${stamp}`, nameBs: 'D', nameEn: 'D', durationMultiplier: 1.6 },
      }),
    ]);

    const cleaner = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-catalog`,
        email: `catalog-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: {
          create: {
            services: {
              create: [{ serviceTypeId: standard.id }, { serviceTypeId: deep.id }],
            },
          },
        },
      },
      include: { cleanerProfile: { include: { services: { include: { serviceType: true } } } } },
    });

    const offeredKeys = cleaner.cleanerProfile?.services.map((s) => s.serviceType.key).sort();
    expect(offeredKeys).toEqual([`link-deep-${stamp}`, `link-standard-${stamp}`].sort());

    // Re-linking the same pair is rejected by the composite unique constraint.
    await expect(
      prisma.cleanerService.create({
        data: {
          cleanerProfileId: cleaner.cleanerProfile!.id,
          serviceTypeId: standard.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('creates a versioned pricing config scoped to a city', async () => {
    const city = await prisma.city.create({
      data: { name: `Pricegrad ${stamp}`, slug: `pricegrad-${stamp}` },
    });

    const v1 = await prisma.pricingConfig.create({
      data: {
        cityId: city.id,
        version: 1,
        active: true,
        m2Bands: [
          { maxM2: 40, hours: 2.0 },
          { maxM2: 60, hours: 2.5 },
        ],
        rateMinF: 800,
        rateMaxF: 1500,
        platformFeePct: 20,
        recurringDiscountPct: { weekly: 10, biweekly: 7, monthly: 5 },
        cancellationRules: [
          { hoursBefore: 24, refundPct: 100 },
          { hoursBefore: 0, refundPct: 50 },
          { noShow: true, refundPct: 0 },
        ],
      },
    });

    // Declared defaults land as specified (D7/§5 numbers), not invented here.
    expect(v1.negativeBalanceLimitF).toBe(-5000);
    expect(v1.autoConfirmHours).toBe(48);
    expect(v1.minAfterPhotosPerRoom).toBe(2);
    expect(v1.cashFeeF).toBeNull();
    expect(v1.vatMode).toBeNull();

    // Same city, next version — versioning coexists (E2.3 owns "one active" enforcement).
    const v2 = await prisma.pricingConfig.create({
      data: {
        cityId: city.id,
        version: 2,
        active: false,
        m2Bands: v1.m2Bands as object,
        rateMinF: 900,
        rateMaxF: 1600,
        platformFeePct: 22,
        recurringDiscountPct: { weekly: 10, biweekly: 7, monthly: 5 },
        cancellationRules: v1.cancellationRules as object,
      },
    });
    expect(v2.version).toBe(2);

    await expect(
      prisma.pricingConfig.create({
        data: {
          cityId: city.id,
          version: 1, // duplicate (cityId, version)
          m2Bands: [],
          rateMinF: 100,
          rateMaxF: 200,
          platformFeePct: 20,
          recurringDiscountPct: {},
          cancellationRules: [],
        },
      }),
    ).rejects.toThrow();

    const configs = await prisma.pricingConfig.findMany({
      where: { cityId: city.id },
      orderBy: { version: 'asc' },
    });
    expect(configs.map((c) => c.version)).toEqual([1, 2]);
  });
});
