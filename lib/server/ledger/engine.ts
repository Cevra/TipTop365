import 'server-only';
import { prisma } from '@/lib/server/db';
import { balanceDelta } from '@/lib/domain/ledger/accounts';
import { validatePlan, type PostingPlan } from '@/lib/domain/ledger/postings';

// Posting engine (E5.1, §7). One $transaction per plan:
//   1. replay check on the idempotency key → no-op (webhook-safe),
//   2. get-or-create the touched wallet accounts,
//   3. append ledger_entries (never updated — corrections are new postings),
//   4. atomically increment materialized balances by each account's
//      normal-side delta.
// Concurrency: the unique idempotency_key decides duplicate races (loser
// replays); balance updates use atomic increments so concurrent DIFFERENT
// postings never lose writes.

export interface PostResult {
  replayed: boolean;
  entryIds: string[];
}

// Account identity rows are resolved OUTSIDE the posting transaction: in
// Postgres a caught unique-violation still aborts the enclosing tx (no
// savepoints through Prisma), so the create-race recovery must not run inside
// one. A pre-created account row with no entries is harmless if the posting
// tx later rolls back.
async function getOrCreateAccount(type: string, ownerId: string | null): Promise<{ id: string }> {
  const existing = await prisma.walletAccount.findFirst({
    where: { ownerType: type, ownerId },
    select: { id: true },
  });
  if (existing) return existing;
  try {
    return await prisma.walletAccount.create({
      data: { ownerType: type, ownerId },
      select: { id: true },
    });
  } catch (err) {
    // Concurrent creation of the same account (unique pair) — reread.
    if ((err as { code?: string }).code === 'P2002') {
      const again = await prisma.walletAccount.findFirst({
        where: { ownerType: type, ownerId },
        select: { id: true },
      });
      if (again) return again;
    }
    throw err;
  }
}

export async function post(plan: PostingPlan): Promise<PostResult> {
  validatePlan(plan);

  const keyFor = (i: number) =>
    plan.entries.length === 1 ? plan.idempotencyKey : `${plan.idempotencyKey}#${i}`;

  // Fast replay check outside the tx (the unique constraint remains the gate).
  const existing = await prisma.ledgerEntry.findMany({
    where: { idempotencyKey: { in: plan.entries.map((_, i) => keyFor(i)) } },
    select: { id: true },
  });
  if (existing.length > 0) return { replayed: true, entryIds: existing.map((e) => e.id) };

  // Resolve account ids up front (see getOrCreateAccount note).
  const accountIds = new Map<string, string>();
  for (const entry of plan.entries) {
    for (const ref of [entry.debit, entry.credit]) {
      const key = `${ref.type}:${ref.ownerId ?? ''}`;
      if (!accountIds.has(key)) {
        accountIds.set(key, (await getOrCreateAccount(ref.type, ref.ownerId)).id);
      }
    }
  }
  const idFor = (ref: { type: string; ownerId: string | null }) =>
    accountIds.get(`${ref.type}:${ref.ownerId ?? ''}`)!;

  try {
    const entryIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (let i = 0; i < plan.entries.length; i++) {
        const entry = plan.entries[i];
        const debitAccount = { id: idFor(entry.debit) };
        const creditAccount = { id: idFor(entry.credit) };

        const row = await tx.ledgerEntry.create({
          data: {
            txId: plan.idempotencyKey,
            bookingId: plan.bookingId,
            payoutId: plan.payoutId,
            debitAccountId: debitAccount.id,
            creditAccountId: creditAccount.id,
            amountF: entry.amountF,
            kind: entry.kind,
            idempotencyKey: keyFor(i),
            memo: entry.memo,
          },
          select: { id: true },
        });
        ids.push(row.id);

        await tx.walletAccount.update({
          where: { id: debitAccount.id },
          data: { balanceF: { increment: balanceDelta(entry.debit.type, 'debit', entry.amountF) } },
        });
        await tx.walletAccount.update({
          where: { id: creditAccount.id },
          data: { balanceF: { increment: balanceDelta(entry.credit.type, 'credit', entry.amountF) } },
        });
      }
      return ids;
    });
    return { replayed: false, entryIds };
  } catch (err) {
    // Duplicate-key race: another process posted the same plan first — replay.
    if ((err as { code?: string }).code === 'P2002') {
      const rows = await prisma.ledgerEntry.findMany({
        where: { txId: plan.idempotencyKey },
        select: { id: true },
      });
      return { replayed: true, entryIds: rows.map((r) => r.id) };
    }
    throw err;
  }
}

/** §7: cleaner_net_balance = payable − receivable (both in normal balances). */
export async function cleanerNetBalanceF(cleanerId: string): Promise<number> {
  const accounts = await prisma.walletAccount.findMany({
    where: { ownerId: cleanerId, ownerType: { in: ['cleaner_payable', 'cleaner_receivable'] } },
  });
  const payable = accounts.find((a) => a.ownerType === 'cleaner_payable')?.balanceF ?? 0;
  const receivable = accounts.find((a) => a.ownerType === 'cleaner_receivable')?.balanceF ?? 0;
  return payable - receivable;
}
