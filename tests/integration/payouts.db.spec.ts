import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { isoWeekLabel, markRunPaid, payoutRunCsv, preparePayoutRun } from '@/lib/server/payouts';

// Integration (E5.5): the full run lifecycle — eligibility, CSV, idempotent
// paid postings — against real Postgres.

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const week = `2099-W${String((Date.now() % 50) + 1).padStart(2, '0')}`; // collision-free label

async function cleanerWithBalance(suffix: string, balanceF: number, iban: string | null) {
  const user = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}`,
      email: `po-${suffix}-${stamp}@test.local`,
      role: 'cleaner',
      firstName: 'Isplata',
      lastName: suffix.toUpperCase(),
      cleanerProfile: { create: {} },
      ...(iban ? { cleanerLegalProfile: { create: { bankAccountIban: iban } } } : {}),
    },
    include: { cleanerProfile: true },
  });
  const cleanerId = user.cleanerProfile!.id;
  await prisma.walletAccount.create({
    data: { ownerType: 'cleaner_payable', ownerId: cleanerId, balanceF },
  });
  return { user, cleanerId };
}

afterAll(async () => {
  // FK order: ledger entries referencing this run's payouts AND this suite's
  // wallet accounts first, then payouts/run, then accounts, then people.
  await prisma.ledgerEntry.deleteMany({
    where: { payout: { payoutRun: { weekLabel: week } } },
  });
  await prisma.payout.deleteMany({ where: { payoutRun: { weekLabel: week } } });
  await prisma.payoutRun.deleteMany({ where: { weekLabel: week } });
  const cleanerIds = (
    await prisma.cleanerProfile.findMany({
      where: { user: { email: { contains: stamp } } },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.ledgerEntry.deleteMany({
    where: {
      OR: [
        { debitAccount: { ownerId: { in: cleanerIds } } },
        { creditAccount: { ownerId: { in: cleanerIds } } },
      ],
    },
  });
  await prisma.walletAccount.deleteMany({ where: { ownerId: { in: cleanerIds } } });
  await prisma.cleanerLegalProfile.deleteMany({ where: { cleaner: { email: { contains: stamp } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('payout runs (E5.5)', () => {
  it('prepares only eligible cleaners, exports CSV, pays idempotently', async () => {
    const paid = await cleanerWithBalance('ok', 4800, 'BA391290079401028494');
    const noIban = await cleanerWithBalance('noiban', 3000, null);

    const { run, skipped } = await preparePayoutRun(week, null);
    expect(run.payouts.some((p) => p.cleanerId === paid.cleanerId)).toBe(true);
    expect(run.payouts.some((p) => p.cleanerId === noIban.cleanerId)).toBe(false);
    expect(skipped.some((s) => s.cleanerId === noIban.cleanerId && s.reason === 'IBAN_MISSING')).toBe(true);
    const myPayout = run.payouts.find((p) => p.cleanerId === paid.cleanerId)!;
    expect(myPayout.amountF).toBe(4800);

    // Duplicate week rejected.
    await expect(preparePayoutRun(week, null)).rejects.toMatchObject({ code: 'RUN_EXISTS' });

    // CSV: semicolons, comma decimals, reference; flips draft → exported.
    const { csv, filename } = await payoutRunCsv(run.id);
    expect(filename).toBe(`tiptop-payouts-${week}.csv`);
    expect(csv).toContain(`Isplata OK;BA391290079401028494;48,00;TipTop365 ${week}`);
    expect((await prisma.payoutRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe('exported');

    // Mark paid: wallet drains via the §7 posting, exactly once.
    const first = await markRunPaid(run.id);
    expect(first.run.status).toBe('paid');
    const wallet = await prisma.walletAccount.findFirstOrThrow({
      where: { ownerType: 'cleaner_payable', ownerId: paid.cleanerId },
    });
    expect(wallet.balanceF).toBe(0);

    const again = await markRunPaid(run.id);
    expect(again.posted).toBe(0); // idempotent — nothing re-posted
    expect(
      (await prisma.walletAccount.findFirstOrThrow({ where: { id: wallet.id } })).balanceF,
    ).toBe(0);
  });

  it('isoWeekLabel produces stable YYYY-Www labels', () => {
    expect(isoWeekLabel(new Date('2026-07-16T12:00:00Z'))).toBe('2026-W29');
    expect(isoWeekLabel(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(isoWeekLabel(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
  });
});
