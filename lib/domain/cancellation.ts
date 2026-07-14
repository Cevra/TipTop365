// Cancellation refund rules (E3.8, plan §6 config / §7 posting map). Pure.
// Rules come from the booking's SNAPSHOTTED pricing config version, shape:
//   [{ hoursBefore: 24, refundPct: 100 }, { hoursBefore: 0, refundPct: 50 },
//    { noShow: true, refundPct: 0 }]
// Semantics: cancelling ≥ rule.hoursBefore hours before the slot earns that
// rule's refundPct; the MOST generous applicable rule wins. No-show is a
// separate admin determination (§5 note) resolved by its own flag.

import { z } from 'zod';

const ruleSchema = z.object({
  hoursBefore: z.number().min(0).optional(),
  noShow: z.boolean().optional(),
  refundPct: z.number().min(0).max(100),
});

export type CancellationRule = z.infer<typeof ruleSchema>;

export class CancellationRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancellationRulesError';
  }
}

export function parseCancellationRules(raw: unknown): CancellationRule[] {
  const parsed = z.array(ruleSchema).min(1).safeParse(raw);
  if (!parsed.success) {
    throw new CancellationRulesError(`cancellation_rules malformed: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function resolveRefundPct(
  rules: CancellationRule[],
  args: { hoursBeforeSlot: number; noShow?: boolean },
): number {
  if (args.noShow) {
    const noShowRule = rules.find((r) => r.noShow === true);
    // §5/§6: no-show keeps 100 % unless the config says otherwise.
    return noShowRule?.refundPct ?? 0;
  }
  const timed = rules
    .filter((r) => r.noShow !== true && r.hoursBefore !== undefined)
    .filter((r) => args.hoursBeforeSlot >= (r.hoursBefore as number));
  if (timed.length === 0) return 0;
  return Math.max(...timed.map((r) => r.refundPct));
}

/** Integer fenings (D5), rounded half up. */
export function computeRefundF(totalF: number, refundPct: number): number {
  return Math.round((totalF * refundPct) / 100);
}
