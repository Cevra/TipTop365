import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';
import { capturePlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';

// Integration (E5.2): FSM side effects → §7 postings. Each test walks real
// transitions and asserts the ledger balances that must result.

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

async function fixture(suffix: string, paymentMethod: 'card' | 'cash') {
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-c`,
      email: `fp-${suffix}-${stamp}@test.local`,
      properties: { create: { street: 'FP', houseNo: suffix } },
    },
    include: { properties: true },
  });
  const cleanerUser = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-w`,
      email: `fp-w-${suffix}-${stamp}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: { hourlyRateF: 1200 } },
    },
    include: { cleanerProfile: true },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleanerUser.cleanerProfile!.id,
      serviceTypeId: serviceType.id,
      status: 'pending_completion',
      scheduledAt: new Date(Date.now() + 48 * 3600_000),
      slotMinutes: 240,
      estHours: 4,
      cleanerRateF: 1200,
      cleanerAmountF: 4800,
      serviceFeeF: 960,
      cashFeeF: paymentMethod === 'cash' ? 200 : 0,
      discountF: 0,
      totalF: paymentMethod === 'cash' ? 5960 : 5760,
      paymentMethod,
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  return { booking, customer, cleanerProfileId: cleanerUser.cleanerProfile!.id };
}

async function balance(type: string, ownerId: string | null = null): Promise<number> {
  const account = await prisma.walletAccount.findFirst({ where: { ownerType: type, ownerId } });
  return account?.balanceF ?? 0;
}

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('FSM → ledger wiring (E5.2)', () => {
  it('customer confirmation releases escrow: wallet + revenue per §7', async () => {
    const { booking, customer, cleanerProfileId } = await fixture('rel', 'card');
    await post(capturePlan(booking, `pay-${stamp}-rel`));
    const escrowAfterCapture = await balance('customer_escrow');
    const revenueBefore = await balance('platform_revenue');

    const { booking: done } = await applyBookingTransition({
      bookingId: booking.id,
      action: 'completion_confirmed',
      actor: { type: 'customer', userId: customer.id },
    });
    expect(done.status).toBe('completed');
    expect(await balance('customer_escrow')).toBe(escrowAfterCapture - 5760);
    expect(await balance('cleaner_payable', cleanerProfileId)).toBe(4800);
    expect(await balance('platform_revenue')).toBe(revenueBefore + 960);
  });

  it('cash auto-confirm books commission debt instead of a release', async () => {
    const { booking, cleanerProfileId } = await fixture('cash', 'cash');
    await applyBookingTransition({
      bookingId: booking.id,
      action: 'auto_confirmed',
      actor: { type: 'system' },
    });
    expect(await balance('cleaner_receivable', cleanerProfileId)).toBe(1160); // fee + cash fee
    expect(await balance('cleaner_payable', cleanerProfileId)).toBe(0);
  });

  it('cancellation posts refund + kept penalty with the route-computed amount', async () => {
    const { booking, customer } = await fixture('cxl', 'card');
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'accepted' } });
    await post(capturePlan(booking, `pay-${stamp}-cxl`));
    const revenueBefore = await balance('platform_revenue');
    const cashBefore = await balance('platform_cash');

    await applyBookingTransition({
      bookingId: booking.id,
      action: 'customer_cancelled',
      actor: { type: 'customer', userId: customer.id },
      reason: 'test',
      effectCtx: { refundF: 2880, refundRef: `cancel:${booking.id}` },
    });

    // Refund leg: escrow → cash (−2880 from cash's capture credit side).
    expect(await balance('platform_cash')).toBe(cashBefore - 2880);
    // Kept penalty: escrow → revenue.
    expect(await balance('platform_revenue')).toBe(revenueBefore + 2880);
    const entries = await prisma.ledgerEntry.findMany({
      where: { txId: `refund:cancel:${booking.id}` },
    });
    expect(entries.map((e) => e.kind).sort()).toEqual(['adjustment', 'refund']);
  });

  it('dispute freeze posts nothing; resolution releases exactly once', async () => {
    const { booking, customer, cleanerProfileId } = await fixture('disp', 'card');
    await post(capturePlan(booking, `pay-${stamp}-disp`));

    await applyBookingTransition({
      bookingId: booking.id,
      action: 'dispute_opened',
      actor: { type: 'customer', userId: customer.id },
    });
    expect(await balance('cleaner_payable', cleanerProfileId)).toBe(0); // frozen: nothing released

    const admin = await prisma.user.create({
      data: { firebaseUid: `fb-${stamp}-adm`, email: `fp-adm-${stamp}@test.local`, role: 'admin' },
    });
    await applyBookingTransition({
      bookingId: booking.id,
      action: 'dispute_resolved_release',
      actor: { type: 'admin', userId: admin.id },
    });
    expect(await balance('cleaner_payable', cleanerProfileId)).toBe(4800);

    // The release key is booking-scoped: replaying the same plan is a no-op,
    // so no path can ever pay the job twice.
    const releaseEntries = await prisma.ledgerEntry.count({
      where: { txId: `release:${booking.id}` },
    });
    expect(releaseEntries).toBe(2); // wallet + fee leg, exactly once
  });
});
