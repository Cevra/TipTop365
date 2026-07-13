import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Integration: round-trips the E1.1 identity block against real Postgres —
// proves the migration, relations and enum columns. Requires DATABASE_URL
// (npm run test:integration). Creates its own rows and deletes them after.
const prisma = new PrismaClient();

const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  // FK-safe teardown order: dependents first, users/cities last.
  await prisma.verificationApplication.deleteMany({ where: { cleaner: { email: { contains: stamp } } } });
  await prisma.cleanerLegalProfile.deleteMany({ where: { cleaner: { email: { contains: stamp } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.city.deleteMany({ where: { slug: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('identity block round-trip', () => {
  it('creates the full identity graph and resolves relations', async () => {
    const city = await prisma.city.create({
      data: { name: `Testgrad ${stamp}`, slug: `testgrad-${stamp}`, launchStage: 'pilot' },
    });

    const cleaner = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-cleaner`,
        email: `cleaner-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: {
          create: {
            bio: 'integration fixture',
            hourlyRateF: 1200,
            cityId: city.id,
            serviceRadiusKm: 10,
            availability: { monday: [{ start: '08:00', end: '16:00' }] },
            languages: ['bs', 'en'],
          },
        },
        cleanerLegalProfile: {
          create: { legalRegime: 'fbih_student', isStudent: true },
        },
      },
      include: { cleanerProfile: true, cleanerLegalProfile: true },
    });

    // Defaults land as declared in the schema.
    expect(cleaner.status).toBe('active');
    expect(cleaner.locale).toBe('bs');
    expect(cleaner.cleanerProfile?.tier).toBe('registered');
    expect(cleaner.cleanerProfile?.engagementModel).toBe('marketplace');
    expect(cleaner.cleanerProfile?.acceptsCash).toBe(true);
    expect(cleaner.cleanerProfile?.hourlyRateF).toBe(1200);
    expect(cleaner.cleanerLegalProfile?.legalRegime).toBe('fbih_student');

    const admin = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-admin`,
        email: `admin-${stamp}@test.local`,
        role: 'admin',
      },
    });

    const application = await prisma.verificationApplication.create({
      data: {
        cleanerId: cleaner.id,
        status: 'interview_scheduled',
        interviewAt: new Date('2026-08-01T10:00:00Z'),
        interviewMode: 'video',
        checklist: { id_verified: true, references_checked: false },
        reviewedById: admin.id,
      },
      include: { cleaner: true, reviewedBy: true },
    });
    expect(application.cleaner.id).toBe(cleaner.id);
    expect(application.reviewedBy?.role).toBe('admin');

    const host = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-host`,
        email: `host-${stamp}@test.local`,
        isHost: true,
        properties: {
          create: {
            label: 'Stan centar',
            type: 'vacation_rental',
            cityId: city.id,
            street: 'Ferhadija',
            houseNo: '12',
            sizeM2: 55,
            rooms: 2,
            bathrooms: 1,
            isAirbnb: true,
            checklist: { linens: true, restock: ['coffee'] },
          },
        },
      },
      include: { properties: { include: { city: true } } },
    });
    expect(host.properties).toHaveLength(1);
    expect(host.properties[0].city?.slug).toBe(`testgrad-${stamp}`);
    expect(host.properties[0].isAirbnb).toBe(true);
  });

  it('enforces unique firebase_uid and one profile per user', async () => {
    const uid = `fb-${stamp}-dup`;
    await prisma.user.create({
      data: { firebaseUid: uid, email: `dup-${stamp}@test.local` },
    });
    await expect(
      prisma.user.create({
        data: { firebaseUid: uid, email: `dup2-${stamp}@test.local` },
      }),
    ).rejects.toThrow();
  });

  it('supports the referral self-relation', async () => {
    const referrer = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-ref1`,
        email: `ref1-${stamp}@test.local`,
        referralCode: `TIP-${stamp}`,
      },
    });
    const referred = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-ref2`,
        email: `ref2-${stamp}@test.local`,
        referredById: referrer.id,
      },
      include: { referredBy: true },
    });
    expect(referred.referredBy?.referralCode).toBe(`TIP-${stamp}`);
  });
});
