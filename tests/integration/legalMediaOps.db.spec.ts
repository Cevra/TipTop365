import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildAuditRecord } from '@/lib/server/audit';

// Integration: round-trips the E1.5 legal/media/ops block against real
// Postgres. Constraint/relation/default checks only — the consuming logic
// (day-limit counting, retention job, double-blind reveal, outbox dispatch)
// lives in E7/E8/E10/E12 with its own suites.
const prisma = new PrismaClient();

const stamp = `it${Date.now() % 1e9}`;

// Minimal booking graph the block's FKs hang off.
async function createBookingFixture(suffix: string) {
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-cust-${suffix}`,
      email: `cust-${suffix}-${stamp}@test.local`,
      properties: { create: { street: 'Test', houseNo: suffix } },
    },
    include: { properties: true },
  });
  const cleanerUser = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-cl-${suffix}`,
      email: `cl-${suffix}-${stamp}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: {} },
    },
    include: { cleanerProfile: true },
  });
  const serviceType = await prisma.serviceType.create({
    data: { key: `svc-${suffix}-${stamp}`, nameBs: 'S', nameEn: 'S', durationMultiplier: 1.0 },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleanerUser.cleanerProfile!.id,
      serviceTypeId: serviceType.id,
      scheduledAt: new Date('2026-08-01T10:00:00Z'),
      slotMinutes: 240,
      estHours: 4,
      cleanerRateF: 1200,
      cleanerAmountF: 4800,
      serviceFeeF: 960,
      cashFeeF: 0,
      discountF: 0,
      totalF: 5760,
      paymentMethod: 'card',
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  return { customer, cleanerProfileId: cleanerUser.cleanerProfile!.id, booking };
}

afterAll(async () => {
  const bookingFilter = { booking: { code: { contains: stamp } } };
  await prisma.promoRedemption.deleteMany({ where: bookingFilter });
  await prisma.promoCode.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.notification.deleteMany({ where: { eventKey: { contains: stamp } } });
  await prisma.dispute.deleteMany({ where: bookingFilter });
  await prisma.review.deleteMany({ where: bookingFilter });
  await prisma.photo.deleteMany({ where: bookingFilter });
  await prisma.dayLimitEntry.deleteMany({ where: bookingFilter });
  await prisma.contract.deleteMany({ where: bookingFilter });
  await prisma.contractTemplate.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.consent.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.deletionRequest.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { contains: stamp } } });
  await prisma.analyticsEvent.deleteMany({ where: { sessionId: { contains: stamp } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.serviceType.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('legal/media/ops block round-trip', () => {
  it('contract template versions + one contract per booking with e-acceptance', async () => {
    const { booking } = await createBookingFixture('c1');

    const template = await prisma.contractTemplate.create({
      data: {
        key: `temp_work_${stamp}`,
        legalRegime: 'fbih_student',
        lang: 'bs',
        version: 1,
        htmlBody: '<h1>Ugovor</h1>',
      },
    });
    expect(template.lawyerApproved).toBe(false); // DRAFT watermark gate default

    // Same key+regime+lang, next version — coexists.
    await prisma.contractTemplate.create({
      data: {
        key: `temp_work_${stamp}`,
        legalRegime: 'fbih_student',
        lang: 'bs',
        version: 2,
        htmlBody: '<h1>Ugovor v2</h1>',
      },
    });
    // Duplicate version — rejected.
    await expect(
      prisma.contractTemplate.create({
        data: {
          key: `temp_work_${stamp}`,
          legalRegime: 'fbih_student',
          lang: 'bs',
          version: 1,
          htmlBody: 'x',
        },
      }),
    ).rejects.toThrow();

    const contract = await prisma.contract.create({
      data: {
        bookingId: booking.id,
        templateVersion: 2,
        pdfUrl: 'private/contracts/x.pdf',
        sha256: 'a'.repeat(64),
        customerAcceptedAt: new Date(),
        customerAcceptedIp: '10.0.0.1',
      },
      include: { booking: true },
    });
    expect(contract.status).toBe('draft');
    expect(contract.cleanerAcceptedAt).toBeNull();
    expect(contract.booking.code).toBe(booking.code);

    // Second contract for the same booking — rejected (bookings ||--o| contracts).
    await expect(
      prisma.contract.create({
        data: { bookingId: booking.id, templateVersion: 2, pdfUrl: 'y.pdf', sha256: 'b'.repeat(64) },
      }),
    ).rejects.toThrow();
  });

  it('day-limit entries: multi-visit day counts once per (cleaner, date, year)', async () => {
    const { booking, cleanerProfileId } = await createBookingFixture('d1');
    const workDate = new Date('2026-08-01');

    await prisma.dayLimitEntry.create({
      data: { cleanerId: cleanerProfileId, bookingId: booking.id, workDate, legalRegime: 'fbih', year: 2026 },
    });
    // Same cleaner, same date — a second visit that day must NOT add a day.
    await expect(
      prisma.dayLimitEntry.create({
        data: { cleanerId: cleanerProfileId, bookingId: booking.id, workDate, legalRegime: 'fbih', year: 2026 },
      }),
    ).rejects.toThrow();
    // Next day is fine.
    await prisma.dayLimitEntry.create({
      data: {
        cleanerId: cleanerProfileId,
        bookingId: booking.id,
        workDate: new Date('2026-08-02'),
        legalRegime: 'fbih',
        year: 2026,
      },
    });
    const used = await prisma.dayLimitEntry.count({
      where: { cleanerId: cleanerProfileId, year: 2026 },
    });
    expect(used).toBe(2);
  });

  it('photos carry retention fields and the tombstone update works', async () => {
    const { booking, customer } = await createBookingFixture('p1');
    const photo = await prisma.photo.create({
      data: {
        bookingId: booking.id,
        kind: 'pre_job',
        storageKey: `bookings/${booking.id}/pre/1.jpg`,
        encKeyWrapped: 'wrapped-key-b64',
        uploadedById: customer.id,
        deleteAfter: new Date('2026-08-02T10:00:00Z'),
      },
    });
    expect(photo.deletedAt).toBeNull();

    // The retention job's scan shape (§9).
    const due = await prisma.photo.findMany({
      where: { deleteAfter: { lt: new Date('2026-09-01') }, deletedAt: null, bookingId: booking.id },
    });
    expect(due.map((p) => p.id)).toContain(photo.id);

    const tombstoned = await prisma.photo.update({
      where: { id: photo.id },
      data: { deletedAt: new Date(), deleteReason: 'retention:pre_job' },
    });
    expect(tombstoned.deleteReason).toBe('retention:pre_job');
  });

  it('reviews: one per direction, double-blind hidden by default', async () => {
    const { booking, customer } = await createBookingFixture('r1');
    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        direction: 'customer_to_cleaner',
        stars: 5,
        tags: ['temeljito', 'ljubazno'],
        body: 'Sve pohvale.',
      },
    });
    expect(review.visible).toBe(false);

    await prisma.review.create({
      data: { bookingId: booking.id, direction: 'cleaner_to_customer', stars: 4 },
    });
    await expect(
      prisma.review.create({
        data: { bookingId: booking.id, direction: 'customer_to_cleaner', stars: 1 },
      }),
    ).rejects.toThrow();

    // Dispute: one per booking, resolution fields round-trip.
    const dispute = await prisma.dispute.create({
      data: { bookingId: booking.id, openedById: customer.id, reason: 'Nije očišćena kuhinja' },
    });
    expect(dispute.status).toBe('open');
    await expect(
      prisma.dispute.create({
        data: { bookingId: booking.id, openedById: customer.id, reason: 'x' },
      }),
    ).rejects.toThrow();
  });

  it('notification outbox defaults + promo redemption uniqueness', async () => {
    const { booking, customer } = await createBookingFixture('n1');

    const notification = await prisma.notification.create({
      data: {
        userId: customer.id,
        bookingId: booking.id,
        eventKey: `booking.accepted.${stamp}`,
        channel: 'push',
        payload: { bookingCode: booking.code },
      },
    });
    expect(notification.status).toBe('pending');
    expect(notification.sentAt).toBeNull();

    const promo = await prisma.promoCode.create({
      data: { code: `WELCOME-${stamp}`, type: 'pct', value: 15, maxPerUser: 1 },
    });
    await prisma.promoRedemption.create({
      data: { promoCodeId: promo.id, userId: customer.id, bookingId: booking.id },
    });
    await expect(
      prisma.promoRedemption.create({
        data: { promoCodeId: promo.id, userId: customer.id, bookingId: booking.id },
      }),
    ).rejects.toThrow();
  });

  it('audit_log accepts a buildAuditRecord output; consents/deletion/analytics round-trip', async () => {
    const { customer } = await createBookingFixture('a1');

    // Prove the E0.7 audit shape maps onto the table (E9 wires the sink).
    const record = buildAuditRecord(
      {
        actorUserId: customer.id,
        action: 'booking.reassign',
        entityType: 'booking',
        entityId: `bk-${stamp}`,
        before: { cleanerId: 'old' },
        after: { cleanerId: 'new' },
        ip: '10.0.0.9',
      },
      new Date().toISOString(),
    );
    const row = await prisma.auditLog.create({
      data: {
        actorUserId: record.actorUserId,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        before: record.before as object,
        after: record.after as object,
        ip: record.ip,
        createdAt: new Date(record.at),
      },
      include: { actor: true },
    });
    expect(row.actor?.id).toBe(customer.id);
    expect(row.before).toMatchObject({ cleanerId: 'old' });

    const consent = await prisma.consent.create({
      data: { userId: customer.id, kind: 'photos', version: '2026-07', grantedAt: new Date() },
    });
    expect(consent.kind).toBe('photos');

    const deletion = await prisma.deletionRequest.create({ data: { userId: customer.id } });
    expect(deletion.status).toBe('open');

    // No user FK: an arbitrary (even already-deleted) userId string is fine.
    const event = await prisma.analyticsEvent.create({
      data: {
        sessionId: `sess-${stamp}`,
        userId: 'ghost-user-gone',
        event: 'booking_wizard_step',
        props: { step: 2 },
      },
    });
    expect(event.userId).toBe('ghost-user-gone');
  });
});
