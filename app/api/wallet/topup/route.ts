import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { getPaymentProvider } from '@/lib/server/payments/mockProvider';
import { topupPlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';
import { walletStatus } from '@/lib/server/wallet';

export const runtime = 'nodejs';

const bodySchema = z.object({
  amountF: z.number().int().min(100).max(100_000), // 1–1000 KM per top-up
  cardToken: z.string().min(1).optional(),
  /** Client-generated intent id — retries of the SAME top-up reuse it so the
   * provider replays instead of double-charging. Omitted → fresh intent. */
  intentId: z.string().min(8).max(64).optional(),
});

/**
 * POST /api/wallet/topup (E5.3, §7): card top-up of cash-commission debt.
 * Mock provider now (E6.4 adds the real card flow) → payments row (kind
 * topup, no booking) → §7 posting platform_cash D / cleaner_receivable C.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireDbUser(await requireSession());
  const profile = await prisma.cleanerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError('NOT_A_CLEANER', 403);

  const body = await parseBody(request, bodySchema);

  const intent = body.intentId ?? crypto.randomUUID();
  const provider = getPaymentProvider();
  const result = await provider.capture({
    idempotencyKey: `topup:${profile.id}:${intent}`,
    amountF: body.amountF,
    currency: 'BAM',
    cardToken: body.cardToken,
    reference: `topup-${profile.id}`,
  });

  const payment = await prisma.payment.create({
    data: {
      provider: provider.name,
      providerRef: result.providerRef,
      kind: 'topup',
      status: result.status,
      amountF: body.amountF,
      cardToken: body.cardToken ?? null,
    },
  });
  if (!result.ok) {
    throw new ApiError('PAYMENT_DECLINED', 402, { reason: result.declineReason });
  }

  await post(topupPlan(profile.id, body.amountF, payment.id));
  return ok({ wallet: await walletStatus(profile.id), payment });
});
