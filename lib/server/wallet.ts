import 'server-only';
import { prisma } from '@/lib/server/db';
import { cleanerNetBalanceF } from '@/lib/server/ledger/engine';

// Cleaner wallet status (E5.3, §7 Bolt/Uber cash model): net = payable −
// receivable; below −negative_balance_limit_f (city config, default −50 KM)
// the cleaner cannot accept new jobs until they top up.

export const DEFAULT_NEGATIVE_BALANCE_LIMIT_F = -5000;

export interface WalletStatus {
  payableF: number;
  receivableF: number;
  netF: number;
  limitF: number;
  blocked: boolean;
}

export async function walletStatus(cleanerProfileId: string): Promise<WalletStatus> {
  const [accounts, profile] = await Promise.all([
    prisma.walletAccount.findMany({
      where: { ownerId: cleanerProfileId, ownerType: { in: ['cleaner_payable', 'cleaner_receivable'] } },
    }),
    prisma.cleanerProfile.findUnique({
      where: { id: cleanerProfileId },
      select: { cityId: true },
    }),
  ]);

  let limitF = DEFAULT_NEGATIVE_BALANCE_LIMIT_F;
  if (profile?.cityId) {
    const cfg = await prisma.pricingConfig.findFirst({
      where: { cityId: profile.cityId, active: true },
      orderBy: { version: 'desc' },
      select: { negativeBalanceLimitF: true },
    });
    if (cfg) limitF = cfg.negativeBalanceLimitF;
  }

  const payableF = accounts.find((a) => a.ownerType === 'cleaner_payable')?.balanceF ?? 0;
  const receivableF = accounts.find((a) => a.ownerType === 'cleaner_receivable')?.balanceF ?? 0;
  const netF = payableF - receivableF;
  return { payableF, receivableF, netF, limitF, blocked: netF < limitF };
}

/** Fast block check for the accept path. */
export async function isCleanerBlocked(cleanerProfileId: string): Promise<boolean> {
  return (await walletStatus(cleanerProfileId)).blocked;
}

export { cleanerNetBalanceF };
