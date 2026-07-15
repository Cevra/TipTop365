import 'server-only';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import { payoutPlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';

// Weekly payout runs (E5.5, §7): prepare (draft) → export bank CSV → operator
// pays at the bank → mark paid → payout postings drain the wallets. A cleaner
// is included when payable > 0, they have an IBAN on file, and none of their
// bookings sit in an open dispute (§7 "no open dispute" freeze).

export async function preparePayoutRun(weekLabel: string, executedById: string | null) {
  const existing = await prisma.payoutRun.findUnique({ where: { weekLabel } });
  if (existing) throw new ApiError('RUN_EXISTS', 409, { weekLabel });

  const payables = await prisma.walletAccount.findMany({
    where: { ownerType: 'cleaner_payable', balanceF: { gt: 0 }, ownerId: { not: null } },
  });

  const skipped: { cleanerId: string; reason: string }[] = [];
  const eligible: { cleanerId: string; amountF: number; iban: string }[] = [];

  for (const account of payables) {
    const cleanerId = account.ownerId!;
    const profile = await prisma.cleanerProfile.findUnique({
      where: { id: cleanerId },
      include: { user: { include: { cleanerLegalProfile: true } } },
    });
    if (!profile) {
      skipped.push({ cleanerId, reason: 'PROFILE_MISSING' });
      continue;
    }
    const iban = profile.user.cleanerLegalProfile?.bankAccountIban;
    if (!iban) {
      skipped.push({ cleanerId, reason: 'IBAN_MISSING' });
      continue;
    }
    const openDisputes = await prisma.dispute.count({
      where: {
        status: { in: ['open', 'investigating'] },
        booking: { cleanerId },
      },
    });
    if (openDisputes > 0) {
      skipped.push({ cleanerId, reason: 'OPEN_DISPUTE' });
      continue;
    }
    eligible.push({ cleanerId, amountF: account.balanceF, iban });
  }

  const run = await prisma.payoutRun.create({
    data: {
      weekLabel,
      executedById,
      totalsF: eligible.reduce((sum, e) => sum + e.amountF, 0),
      payouts: {
        create: eligible.map((e) => ({
          cleanerId: e.cleanerId,
          amountF: e.amountF,
          ibanSnapshot: e.iban,
        })),
      },
    },
    include: { payouts: true },
  });

  return { run, skipped };
}

/** Bank-upload CSV (§7): name;IBAN;amount in KM;reference. Semicolon-separated
 * (BiH bank portals expect ; with comma decimals). */
export async function payoutRunCsv(runId: string): Promise<{ filename: string; csv: string }> {
  const run = await prisma.payoutRun.findUnique({
    where: { id: runId },
    include: {
      payouts: { include: { cleaner: { include: { user: true } } } },
    },
  });
  if (!run) throw new ApiError('RUN_NOT_FOUND', 404);

  const lines = ['ime;iban;iznos_km;referenca'];
  for (const payout of run.payouts) {
    const name = [payout.cleaner.user.firstName, payout.cleaner.user.lastName]
      .filter(Boolean)
      .join(' ')
      .replace(/;/g, ',');
    const km = (payout.amountF / 100).toFixed(2).replace('.', ',');
    lines.push(`${name};${payout.ibanSnapshot};${km};TipTop365 ${run.weekLabel}`);
  }

  if (run.status === 'draft') {
    await prisma.payoutRun.update({ where: { id: runId }, data: { status: 'exported' } });
  }
  return { filename: `tiptop-payouts-${run.weekLabel}.csv`, csv: lines.join('\r\n') + '\r\n' };
}

/**
 * Mark paid after the manual bank upload (§7): one idempotent payout posting
 * per row (cleaner_payable D / platform_cash C) — wallets drain exactly once
 * even if the button is clicked twice.
 */
export async function markRunPaid(runId: string) {
  const run = await prisma.payoutRun.findUnique({
    where: { id: runId },
    include: { payouts: true },
  });
  if (!run) throw new ApiError('RUN_NOT_FOUND', 404);
  if (run.status === 'paid') return { run, posted: 0 };
  if (run.status === 'draft') throw new ApiError('RUN_NOT_EXPORTED', 409);

  let posted = 0;
  for (const payout of run.payouts) {
    const result = await post(payoutPlan(payout.cleanerId, payout.amountF, payout.id));
    if (!result.replayed) posted++;
    await prisma.payout.update({ where: { id: payout.id }, data: { status: 'paid' } });
  }
  const updated = await prisma.payoutRun.update({
    where: { id: runId },
    data: { status: 'paid' },
    include: { payouts: true },
  });
  return { run: updated, posted };
}

/** ISO week label, e.g. 2026-W29 — the weekly cron's default. */
export function isoWeekLabel(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
