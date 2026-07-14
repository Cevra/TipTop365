import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';

// Integration (E3.2): POST /api/bookings — draft creation with server-side
// repricing (range ceiling), addon snapshots and recurring-plan linkage.

const sessionState: { current: SessionClaims | null } = { current: null };

vi.mock('@/lib/server/auth/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/auth/session')>();
  return {
    ...original,
    requireSession: vi.fn(async () => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      return sessionState.current;
    }),
  };
});

import { POST as createBooking } from '@/app/api/bookings/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const claims: SessionClaims = {
  uid: `fb-${stamp}-wiz`,
  role: 'customer',
  verified: false,
  email: `wiz-${stamp}@test.local`,
};

let propertyId = '';

function post(body: Record<string, unknown>): Promise<Response> {
  return createBooking(
    new Request('http://test.local/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const base = () => ({
  propertyId,
  serviceTypeKey: 'standard',
  addons: [{ key: 'oven', qty: 1 }],
  scheduledAt: '2026-09-20T10:00:00.000Z',
  paymentMethod: 'card',
});

beforeEach(() => {
  sessionState.current = claims;
});

afterAll(async () => {
  await prisma.bookingAddon.deleteMany({ where: { booking: { customer: { email: { contains: stamp } } } } });
  await prisma.booking.deleteMany({ where: { customer: { email: { contains: stamp } } } });
  await prisma.recurringPlan.deleteMany({ where: { customer: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('POST /api/bookings (wizard draft)', () => {
  it('creates a draft repriced server-side at the range ceiling', async () => {
    const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
    const user = await prisma.user.create({
      data: {
        firebaseUid: claims.uid,
        email: claims.email!,
        properties: {
          create: { label: 'Wiz stan', street: 'Test', houseNo: '1', sizeM2: 75, cityId: sarajevo.id },
        },
      },
      include: { properties: true },
    });
    propertyId = user.properties[0].id;

    const res = await post(base());
    expect(res.status).toBe(201);
    const { data } = await res.json();
    const booking = data.booking;

    // 75 m² standard + oven = 4 h; ceiling = rateMax 1500 → 6000 + 20 % = 7200.
    expect(booking.status).toBe('draft');
    expect(booking.estHours).toBe(4);
    expect(booking.cleanerRateF).toBe(1500);
    expect(booking.totalF).toBe(7200);
    expect(booking.pricingSnapshot.kind).toBe('range');
    expect(booking.pricingSnapshot.min.totalF).toBe(3840);
    expect(booking.matchingMode).toBe('broadcast');
    expect(booking.code).toMatch(/^TT-[A-Z2-9]{6}$/);
    expect(booking.slotMinutes).toBe(240);
    expect(booking.addons).toHaveLength(1);
    expect(booking.addons[0].hoursSnapshot).toBe(1);
    expect(booking.recurringPlan).toBeNull();
  });

  it('creates and links a recurring plan with the discount applied', async () => {
    const res = await post({ ...base(), recurring: 'weekly' });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    const booking = data.booking;

    expect(booking.recurringPlan).not.toBeNull();
    expect(booking.recurringPlan.frequency).toBe('weekly');
    expect(booking.recurringPlan.time).toBe('10:00');
    expect(booking.recurringPlan.addonsTemplate).toEqual([{ key: 'oven', qty: 1 }]);
    // Ceiling with weekly −10 %: 6000 − 600 = 5400 + 20 % = 6480.
    expect(booking.discountF).toBe(600);
    expect(booking.totalF).toBe(6480);
  });

  it('rejects incomplete properties, past dates and foreign properties', async () => {
    const past = await post({ ...base(), scheduledAt: '2020-01-01T10:00:00.000Z' });
    expect(past.status).toBe(400);
    expect((await past.json()).error.code).toBe('SCHEDULED_IN_PAST');

    const bare = await prisma.property.create({
      data: {
        owner: { connect: { firebaseUid: claims.uid } },
        street: 'NoSize',
        houseNo: '9',
      },
    });
    const incomplete = await post({ ...base(), propertyId: bare.id });
    expect(incomplete.status).toBe(409);

    sessionState.current = { ...claims, uid: `fb-${stamp}-other`, email: `other-${stamp}@test.local` };
    const foreign = await post(base());
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).error.code).toBe('PROPERTY_NOT_FOUND');
  });
});
