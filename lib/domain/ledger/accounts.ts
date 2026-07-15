// Ledger account model (E5.1, plan §7). Account types are generic strings
// (D19) with the §7 launch vocabulary below; each type declares its NORMAL
// BALANCE SIDE (real double-entry): a debit-normal account's balance grows
// with debits (cash, receivables), a credit-normal one with credits
// (escrow, revenue, payables). §7's `cleaner_net_balance = payable − receivable`
// then works directly on materialized balances.

export const ACCOUNT_TYPES = {
  platform_cash: 'debit',
  platform_revenue: 'credit',
  customer_escrow: 'credit',
  cleaner_payable: 'credit',
  cleaner_receivable: 'debit',
} as const;

export type AccountType = keyof typeof ACCOUNT_TYPES;
export type NormalSide = 'debit' | 'credit';

export class UnknownAccountTypeError extends Error {
  constructor(type: string) {
    super(
      `Unknown ledger account type "${type}" — new engagement models (D19) must register their types in ACCOUNT_TYPES`,
    );
    this.name = 'UnknownAccountTypeError';
  }
}

export function normalSide(type: string): NormalSide {
  const side = ACCOUNT_TYPES[type as AccountType];
  if (!side) throw new UnknownAccountTypeError(type);
  return side;
}

/** Balance delta for one entry hitting this account on the given side. */
export function balanceDelta(type: string, side: 'debit' | 'credit', amountF: number): number {
  return normalSide(type) === side ? amountF : -amountF;
}

export interface AccountRef {
  type: AccountType;
  /** cleaner_profiles id for cleaner-scoped accounts; null for platform singletons. */
  ownerId: string | null;
}

export const PLATFORM_CASH: AccountRef = { type: 'platform_cash', ownerId: null };
export const PLATFORM_REVENUE: AccountRef = { type: 'platform_revenue', ownerId: null };
export const CUSTOMER_ESCROW: AccountRef = { type: 'customer_escrow', ownerId: null };
export const cleanerPayable = (cleanerId: string): AccountRef => ({ type: 'cleaner_payable', ownerId: cleanerId });
export const cleanerReceivable = (cleanerId: string): AccountRef => ({ type: 'cleaner_receivable', ownerId: cleanerId });
