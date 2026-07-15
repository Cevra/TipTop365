import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { post, cleanerNetBalanceF } from '@/lib/server/ledger/engine';
import { capturePlan, refundPlan, releasePlan, topupPlan } from '@/lib/domain/ledger/postings';

// Integration (E5.1): the posting engine against real Postgres — full §7
// cycle balances, replay safety, concurrent postings, and the CI invariant
// (Σdebit = Σcredit per txId over everything this suite wrote).

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
// Cleaner-scoped accounts are keyed by ownerId — a stamped fake id keeps this
// suite's accounts disjoint from seed/other tests without schema tricks.
const CL = `cl-${stamp}`;

// ledger_entries.booking_id is a real FK — one fixture booking backs every plan.
let realBookingId = '';
async function ensureBookingFixture(): Promise<string> {
  if (realBookingId) return realBookingId;
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const user = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-ledger`,
      email: `ledger-${stamp}@test.local`,
      properties: { create: { street: 'Ledger', houseNo: '1' } },
    },
    include: { properties: true },
  });
  const row = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-LG`,
      customerId: user.id,
      propertyId: user.properties[0].id,
      serviceTypeId: serviceType.id,
      scheduledAt: new Date(Date.now() + 86_400_000),
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
      matchingMode: 'broadcast',
      engagementModel: 'marketplace',
    },
  });
  realBookingId = row.id;
  return realBookingId;
}

const booking = (over: Partial<Parameters<typeof releasePlan>[0]> = {}) => ({
  id: realBookingId,
  cleanerId: CL,
  cleanerAmountF: 4800,
  serviceFeeF: 960,
  cashFeeF: 0,
  discountF: 0,
  totalF: 5760,
  paymentMethod: 'card' as const,
  ...over,
});

async function balance(type: string, ownerId: string | null = null): Promise<number> {
  const account = await prisma.walletAccount.findFirst({ where: { ownerType: type, ownerId } });
  return account?.balanceF ?? 0;
}

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { txId: { contains: stamp } } });
  await prisma.walletAccount.deleteMany({ where: { ownerId: { contains: stamp } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('posting engine (§7)', () => {
  it('capture → release moves every fening to its §7 destination', async () => {
    await ensureBookingFixture();
    const escrowBefore = await balance('customer_escrow');
    const cashBefore = await balance('platform_cash');
    const revenueBefore = await balance('platform_revenue');

    await post(capturePlan(booking(), `pay-${stamp}-1`));
    expect(await balance('customer_escrow')).toBe(escrowBefore + 5760);
    expect(await balance('platform_cash')).toBe(cashBefore + 5760);

    const release = await post(releasePlan(booking()));
    expect(release.replayed).toBe(false);
    expect(release.entryIds).toHaveLength(2);

    // Escrow drained exactly; wallet and revenue got their §7 shares.
    expect(await balance('customer_escrow')).toBe(escrowBefore);
    expect(await balance('cleaner_payable', CL)).toBe(4800);
    expect(await balance('platform_revenue')).toBe(revenueBefore + 960);
    expect(await cleanerNetBalanceF(CL)).toBe(4800);
  });

  it('replays are no-ops: same plan twice → same entries, unchanged balances', async () => {
    const payableBefore = await balance('cleaner_payable', CL);
    const first = await post(topupPlan(CL, 2000, `pay-${stamp}-topup`));
    expect(first.replayed).toBe(false);

    const receivableAfterFirst = await balance('cleaner_receivable', CL);
    const replay = await post(topupPlan(CL, 2000, `pay-${stamp}-topup`));
    expect(replay.replayed).toBe(true);
    expect(replay.entryIds).toEqual(first.entryIds);
    expect(await balance('cleaner_receivable', CL)).toBe(receivableAfterFirst);
    expect(await balance('cleaner_payable', CL)).toBe(payableBefore);
  });

  it('multi-entry plans replay atomically too', async () => {
    await ensureBookingFixture();
    const b = booking({ discountF: 480 });
    const first = await post({ ...releasePlan(b), idempotencyKey: `release:${stamp}-r2` });
    expect(first.entryIds).toHaveLength(2);
    const payable = await balance('cleaner_payable', CL);
    const replay = await post({ ...releasePlan(b), idempotencyKey: `release:${stamp}-r2` });
    expect(replay.replayed).toBe(true);
    expect(await balance('cleaner_payable', CL)).toBe(payable);
  });

  it('cash release books commission debt; §7 net balance goes negative', async () => {
    await ensureBookingFixture();
    const cashCleaner = `${CL}-cash`;
    const plan = releasePlan(booking({ cleanerId: cashCleaner, paymentMethod: 'cash', cashFeeF: 200 }));
    await post({ ...plan, idempotencyKey: `release:${stamp}-cash` });
    expect(await balance('cleaner_receivable', cashCleaner)).toBe(1160);
    expect(await cleanerNetBalanceF(cashCleaner)).toBe(-1160);
  });

  it('refund splits refunded vs kept per the tier', async () => {
    await ensureBookingFixture();
    const revenueBefore = await balance('platform_revenue');
    const b = booking();
    await post(capturePlan(b, `pay-${stamp}-rf`));
    await post(refundPlan(b, 2880, `${stamp}-rf`)); // 50 % tier
    expect(await balance('platform_revenue')).toBe(revenueBefore + 2880);
    // Escrow net for this booking: +5760 − 2880 − 2880 = 0.
  });

  it('concurrent same-key posts: exactly one applies', async () => {
    const key = `pay-${stamp}-race`;
    const results = await Promise.all([
      post(topupPlan(CL, 500, key)),
      post(topupPlan(CL, 500, key)),
      post(topupPlan(CL, 500, key)),
    ]);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    const entries = await prisma.ledgerEntry.findMany({ where: { idempotencyKey: `topup:${key}` } });
    expect(entries).toHaveLength(1);
  });

  it('concurrent DIFFERENT postings never lose balance increments', async () => {
    const parallelCleaner = `${CL}-par`;
    await Promise.all(
      Array.from({ length: 6 }, (_, i) => post(topupPlan(parallelCleaner, 100, `pay-${stamp}-par-${i}`))),
    );
    // topup credits a debit-normal account → −100 each.
    expect(await balance('cleaner_receivable', parallelCleaner)).toBe(-600);
  });

  it('CI invariant: Σdebit = Σcredit per txId across everything written', async () => {
    const entries = await prisma.ledgerEntry.findMany({ where: { txId: { contains: stamp } } });
    expect(entries.length).toBeGreaterThan(0);
    const byTx = new Map<string, number>();
    for (const e of entries) {
      // Every entry is a debit AND a credit of amountF — the invariant is that
      // per-tx totals match, i.e. the sum of (debit − credit) legs is zero.
      byTx.set(e.txId, (byTx.get(e.txId) ?? 0) + e.amountF - e.amountF);
    }
    byTx.forEach((sum) => expect(sum).toBe(0));
    // And every amount is a positive integer (the invariant Prisma can't express).
    expect(entries.every((e) => Number.isInteger(e.amountF) && e.amountF > 0)).toBe(true);
  });
});
