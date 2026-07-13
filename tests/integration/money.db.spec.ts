import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Integration: round-trips the E1.4 money block against real Postgres —
// wallet_accounts, ledger_entries, payments, payout_runs, payouts. Schema-level
// checks only (constraints, relations, defaults); the balanced-tx and
// idempotent-replay BEHAVIOR belongs to E5.1's posting engine and its suite.
const prisma = new PrismaClient();

const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { idempotencyKey: { contains: stamp } } });
  await prisma.payout.deleteMany({ where: { payoutRun: { weekLabel: { contains: stamp } } } });
  await prisma.payoutRun.deleteMany({ where: { weekLabel: { contains: stamp } } });
  await prisma.payment.deleteMany({ where: { providerRef: { contains: stamp } } });
  await prisma.walletAccount.deleteMany({ where: { ownerType: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('money block round-trip', () => {
  it('creates §7 accounts and a balanced two-leg capture posting', async () => {
    // ownerType carries the fixture stamp so cleanup stays scoped to this run;
    // real accounts use the bare §7 names (platform_cash, customer_escrow, …).
    const platformCash = await prisma.walletAccount.create({
      data: { ownerType: `platform_cash_${stamp}` },
    });
    const escrow = await prisma.walletAccount.create({
      data: { ownerType: `customer_escrow_${stamp}` },
    });
    expect(platformCash.balanceF).toBe(0);
    expect(platformCash.blocked).toBe(false);
    expect(platformCash.ownerId).toBeNull();

    // Card captured (§7 posting map): debit platform_cash, credit customer_escrow.
    const entry = await prisma.ledgerEntry.create({
      data: {
        txId: `tx-${stamp}-capture`,
        debitAccountId: platformCash.id,
        creditAccountId: escrow.id,
        amountF: 5760,
        kind: 'capture',
        idempotencyKey: `capture:${stamp}:pay1`,
        memo: 'worked example §6 total',
      },
      include: { debitAccount: true, creditAccount: true },
    });
    expect(entry.debitAccount.ownerType).toBe(`platform_cash_${stamp}`);
    expect(entry.creditAccount.ownerType).toBe(`customer_escrow_${stamp}`);
  });

  it('rejects a replayed idempotency key at the DB level', async () => {
    const a = await prisma.walletAccount.create({ data: { ownerType: `acc_a_${stamp}` } });
    const b = await prisma.walletAccount.create({ data: { ownerType: `acc_b_${stamp}` } });
    const key = `release:${stamp}:booking1`;
    await prisma.ledgerEntry.create({
      data: {
        txId: `tx-${stamp}-r1`,
        debitAccountId: a.id,
        creditAccountId: b.id,
        amountF: 4800,
        kind: 'release',
        idempotencyKey: key,
      },
    });
    await expect(
      prisma.ledgerEntry.create({
        data: {
          txId: `tx-${stamp}-r2`,
          debitAccountId: a.id,
          creditAccountId: b.id,
          amountF: 4800,
          kind: 'release',
          idempotencyKey: key, // replay — must violate the unique constraint
        },
      }),
    ).rejects.toThrow();
  });

  it('scopes cleaner accounts by (owner_type, owner_id) and rejects duplicates', async () => {
    const cleanerUser = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-wallet`,
        email: `wallet-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: { create: {} },
      },
      include: { cleanerProfile: true },
    });
    const cleanerId = cleanerUser.cleanerProfile!.id;

    // payable and receivable coexist for the same cleaner (different ownerType).
    const payable = await prisma.walletAccount.create({
      data: { ownerType: `cleaner_payable_${stamp}`, ownerId: cleanerId },
    });
    await prisma.walletAccount.create({
      data: { ownerType: `cleaner_receivable_${stamp}`, ownerId: cleanerId },
    });
    expect(payable.ownerId).toBe(cleanerId);

    await expect(
      prisma.walletAccount.create({
        data: { ownerType: `cleaner_payable_${stamp}`, ownerId: cleanerId }, // duplicate pair
      }),
    ).rejects.toThrow();
  });

  it('stores a payment with provider vocabulary and a topup without a booking', async () => {
    const capture = await prisma.payment.create({
      data: {
        provider: 'mock',
        providerRef: `mock-${stamp}-1`,
        kind: 'capture',
        status: 'succeeded',
        amountF: 5760,
        threedsStatus: 'frictionless',
        webhookPayload: { event: 'payment.captured', raw: true },
      },
    });
    expect(capture.bookingId).toBeNull();
    expect(capture.webhookPayload).toMatchObject({ event: 'payment.captured' });

    const topup = await prisma.payment.create({
      data: {
        provider: 'mock',
        providerRef: `mock-${stamp}-topup`,
        kind: 'topup',
        status: 'succeeded',
        amountF: 2000,
      },
    });
    expect(topup.kind).toBe('topup');
    expect(topup.bookingId).toBeNull();
  });

  it('builds a payout run with one payout per cleaner and links ledger postings', async () => {
    const admin = await prisma.user.create({
      data: { firebaseUid: `fb-${stamp}-payadmin`, email: `payadmin-${stamp}@test.local`, role: 'admin' },
    });
    const cleanerUser = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-paid`,
        email: `paid-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: { create: {} },
      },
      include: { cleanerProfile: true },
    });
    const cleanerId = cleanerUser.cleanerProfile!.id;

    const run = await prisma.payoutRun.create({
      data: {
        weekLabel: `2026-W33-${stamp}`,
        executedById: admin.id,
        totalsF: 4800,
        payouts: {
          create: [{ cleanerId, amountF: 4800, ibanSnapshot: 'BA391290079401028494' }],
        },
      },
      include: { payouts: true, executedBy: true },
    });
    expect(run.status).toBe('draft');
    expect(run.payouts).toHaveLength(1);
    expect(run.payouts[0].status).toBe('pending');
    expect(run.executedBy?.role).toBe('admin');

    // Second payout for the same cleaner in the same run — rejected.
    await expect(
      prisma.payout.create({
        data: { payoutRunId: run.id, cleanerId, amountF: 100, ibanSnapshot: 'BA39...' },
      }),
    ).rejects.toThrow();

    // Weekly payout posting (§7): debit cleaner_payable, credit platform_cash,
    // linked to the payout row.
    const payable = await prisma.walletAccount.create({
      data: { ownerType: `payout_payable_${stamp}`, ownerId: cleanerId },
    });
    const cash = await prisma.walletAccount.create({
      data: { ownerType: `payout_cash_${stamp}` },
    });
    const posting = await prisma.ledgerEntry.create({
      data: {
        txId: `tx-${stamp}-payout`,
        payoutId: run.payouts[0].id,
        debitAccountId: payable.id,
        creditAccountId: cash.id,
        amountF: 4800,
        kind: 'payout',
        idempotencyKey: `payout:${stamp}:${run.payouts[0].id}`,
      },
      include: { payout: true },
    });
    expect(posting.payout?.cleanerId).toBe(cleanerId);

    // Duplicate week label — rejected.
    await expect(
      prisma.payoutRun.create({ data: { weekLabel: `2026-W33-${stamp}` } }),
    ).rejects.toThrow();
  });
});
