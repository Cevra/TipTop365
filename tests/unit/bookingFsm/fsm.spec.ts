import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '@prisma/client';
import {
  actionsFor,
  IllegalTransitionError,
  isTerminal,
  transition,
  TRANSITIONS,
  WrongActorError,
} from '@/lib/domain/bookingFsm';

// The §5 diagram has exactly these edges — the table must never drift from it
// silently. If a future task adds an edge, this count (and the pairs below)
// must change in the same commit, making the diff reviewable.
describe('transition table integrity (§5 diagram)', () => {
  it('has exactly the 20 edges of the diagram + notes', () => {
    expect(TRANSITIONS).toHaveLength(20);
  });

  it('covers every §5 status; completed/refunded/cancelled/expired are terminal', () => {
    const sources = new Set(TRANSITIONS.map((t) => t.from));
    for (const s of ['draft', 'pending_payment', 'matching', 'accepted', 'on_my_way', 'in_progress', 'pending_completion', 'disputed'] as BookingStatus[]) {
      expect(sources).toContain(s);
    }
    for (const s of ['completed', 'refunded', 'cancelled', 'expired'] as BookingStatus[]) {
      expect(isTerminal(s)).toBe(true);
    }
  });

  it('every target and source is a real BookingStatus reachable from draft', () => {
    // Walk the graph from draft; §5 has no orphan states.
    const reachable = new Set<BookingStatus>(['draft']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of TRANSITIONS) {
        if (reachable.has(t.from) && !reachable.has(t.to)) {
          reachable.add(t.to);
          grew = true;
        }
      }
    }
    for (const t of TRANSITIONS) {
      expect(reachable).toContain(t.from);
      expect(reachable).toContain(t.to);
    }
  });
});

describe('happy path (§5)', () => {
  it('walks draft → completed via customer confirmation', () => {
    expect(transition('draft', 'contract_accepted', 'customer').to).toBe('pending_payment');
    expect(transition('pending_payment', 'payment_secured', 'system').to).toBe('matching');
    expect(transition('matching', 'cleaner_accepted', 'cleaner').to).toBe('accepted');
    expect(transition('accepted', 'cleaner_started_travel', 'cleaner').to).toBe('on_my_way');
    expect(transition('on_my_way', 'checked_in', 'cleaner').to).toBe('in_progress');
    expect(transition('in_progress', 'finished', 'cleaner').to).toBe('pending_completion');
    expect(transition('pending_completion', 'completion_confirmed', 'customer').to).toBe('completed');
  });

  it('auto-confirm (48 h) is the system twin of customer confirmation', () => {
    const auto = transition('pending_completion', 'auto_confirmed', 'system');
    expect(auto.to).toBe('completed');
    expect(auto.sideEffects).toContain('ledger.release');
  });
});

describe('side-effect descriptors (§5 annotations)', () => {
  it('release fires on both completion edges, freeze on dispute, purge on check-in', () => {
    expect(transition('pending_completion', 'completion_confirmed', 'customer').sideEffects).toEqual(['ledger.release']);
    expect(transition('pending_completion', 'dispute_opened', 'customer').sideEffects).toEqual(['payout_freeze']);
    expect(transition('on_my_way', 'checked_in', 'cleaner').sideEffects).toEqual(['purge_prejob_photos']);
    expect(transition('accepted', 'cleaner_cancelled', 'cleaner').sideEffects).toEqual(['rematch']);
  });

  it('dispute resolutions map release/partial → completed, refund → refunded', () => {
    expect(transition('disputed', 'dispute_resolved_release', 'admin').to).toBe('completed');
    expect(transition('disputed', 'dispute_resolved_partial', 'admin').to).toBe('completed');
    const refund = transition('disputed', 'dispute_resolved_refund', 'admin');
    expect(refund.to).toBe('refunded');
    expect(refund.sideEffects).toEqual(['ledger.refund']);
  });
});

describe('re-matching & cancellations (§5 notes)', () => {
  it('cleaner cancel from accepted goes BACK to matching, not cancelled', () => {
    expect(transition('accepted', 'cleaner_cancelled', 'cleaner').to).toBe('matching');
  });

  it('customer cancels free from matching, per-rules from accepted', () => {
    expect(transition('matching', 'customer_cancelled', 'customer').to).toBe('cancelled');
    expect(transition('accepted', 'customer_cancelled', 'customer').to).toBe('cancelled');
  });

  it('no-show is an admin action from accepted and on_my_way only', () => {
    expect(transition('accepted', 'no_show_reported', 'admin').to).toBe('cancelled');
    expect(transition('on_my_way', 'no_show_reported', 'admin').to).toBe('cancelled');
    expect(() => transition('in_progress', 'no_show_reported', 'admin')).toThrow(IllegalTransitionError);
  });
});

describe('illegal transitions throw', () => {
  it.each([
    ['draft', 'checked_in'],
    ['draft', 'cleaner_accepted'],
    ['completed', 'dispute_opened'],
    ['cancelled', 'contract_accepted'],
    ['expired', 'cleaner_accepted'],
    ['refunded', 'completion_confirmed'],
    ['in_progress', 'customer_cancelled'], // §5: no cancel once work started
    ['on_my_way', 'customer_cancelled'],
  ] as const)('%s --%s→ throws IllegalTransitionError', (from, action) => {
    expect(() => transition(from as BookingStatus, action, 'customer')).toThrow(
      IllegalTransitionError,
    );
  });
});

describe('actor enforcement', () => {
  it('rejects the wrong actor with WrongActorError', () => {
    expect(() => transition('matching', 'cleaner_accepted', 'customer')).toThrow(WrongActorError);
    expect(() => transition('pending_completion', 'completion_confirmed', 'cleaner')).toThrow(WrongActorError);
    expect(() => transition('pending_completion', 'auto_confirmed', 'customer')).toThrow(WrongActorError);
    expect(() => transition('disputed', 'dispute_resolved_refund', 'customer')).toThrow(WrongActorError);
  });

  it('admin is not a wildcard — customer/cleaner edges reject admin', () => {
    expect(() => transition('draft', 'contract_accepted', 'admin')).toThrow(WrongActorError);
    expect(() => transition('on_my_way', 'checked_in', 'admin')).toThrow(WrongActorError);
  });
});

describe('actionsFor (drives screen buttons)', () => {
  it('lists per-actor actions for a status', () => {
    expect(actionsFor('pending_completion', 'customer').sort()).toEqual([
      'completion_confirmed',
      'dispute_opened',
    ]);
    expect(actionsFor('accepted', 'cleaner').sort()).toEqual([
      'cleaner_cancelled',
      'cleaner_started_travel',
    ]);
    expect(actionsFor('completed', 'customer')).toEqual([]);
  });
});
