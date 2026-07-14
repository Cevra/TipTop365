// Booking lifecycle state machine (E3.4, plan §5) — single source of truth.
// Every edge below maps 1:1 to the §5 mermaid diagram + its notes; no invented
// states or transitions. Pure module: the table + lookup only. Applying a
// transition (status update + booking_events row, in one tx) lives in
// lib/server/bookings/applyTransition.ts; ledger hooks are E5, notifications
// E10 — both consume the sideEffects descriptors, they are not implemented here.

import type { BookingStatus, BookingActorType } from '@prisma/client';

export type BookingAction =
  | 'contract_accepted' // customer accepts ToS + engagement contract at checkout
  | 'payment_secured' // card captured (D7) or cash allowed
  | 'payment_failed'
  | 'payment_abandoned' // 1 h without payment
  | 'cleaner_accepted' // direct accept or broadcast first-wins (E3.6)
  | 'offers_expired' // no acceptance before slot −6 h
  | 'customer_cancelled'
  | 'cleaner_cancelled' // from accepted → re-matching (§5 note)
  | 'no_show_reported' // admin determination (§5 note)
  | 'cleaner_started_travel'
  | 'checked_in' // GPS ≤300 m gate enforced by E4.3 before calling
  | 'finished' // ≥N after-photos gate enforced by E4.4 before calling
  | 'completion_confirmed'
  | 'auto_confirmed' // 48 h job (E5.4)
  | 'dispute_opened'
  | 'dispute_resolved_release'
  | 'dispute_resolved_partial'
  | 'dispute_resolved_refund';

/**
 * Side-effect descriptors — consumed by later epics:
 *  ledger.* → E5 posting hooks; rematch → E3.6; purge_prejob_photos → E12.1;
 *  payout_freeze → E5.6 dispute handling. The FSM only names them.
 */
export type SideEffect =
  | 'ledger.release'
  | 'ledger.refund'
  | 'ledger.partial'
  | 'payout_freeze'
  | 'rematch'
  | 'purge_prejob_photos';

export interface Transition {
  from: BookingStatus;
  action: BookingAction;
  /** Who may perform it. `system` = jobs/webhooks (auto-confirm, expiry, PSP). */
  actor: BookingActorType;
  to: BookingStatus;
  sideEffects: SideEffect[];
}

export const TRANSITIONS: readonly Transition[] = [
  // Wizard → payment (§5: draft → pending_payment → matching | cancelled)
  { from: 'draft', action: 'contract_accepted', actor: 'customer', to: 'pending_payment', sideEffects: [] },
  { from: 'pending_payment', action: 'payment_secured', actor: 'system', to: 'matching', sideEffects: [] },
  { from: 'pending_payment', action: 'payment_failed', actor: 'system', to: 'cancelled', sideEffects: [] },
  { from: 'pending_payment', action: 'payment_abandoned', actor: 'system', to: 'cancelled', sideEffects: [] },

  // Matching (§5: matching → accepted | expired | cancelled-free)
  { from: 'matching', action: 'cleaner_accepted', actor: 'cleaner', to: 'accepted', sideEffects: [] },
  { from: 'matching', action: 'offers_expired', actor: 'system', to: 'expired', sideEffects: ['ledger.refund'] },
  { from: 'matching', action: 'customer_cancelled', actor: 'customer', to: 'cancelled', sideEffects: ['ledger.refund'] },

  // Accepted (§5: → on_my_way | cancelled per rules | re-matching on cleaner cancel | admin no-show)
  { from: 'accepted', action: 'cleaner_started_travel', actor: 'cleaner', to: 'on_my_way', sideEffects: [] },
  { from: 'accepted', action: 'customer_cancelled', actor: 'customer', to: 'cancelled', sideEffects: ['ledger.refund'] },
  { from: 'accepted', action: 'cleaner_cancelled', actor: 'cleaner', to: 'matching', sideEffects: ['rematch'] },
  { from: 'accepted', action: 'no_show_reported', actor: 'admin', to: 'cancelled', sideEffects: ['ledger.refund'] },

  // Execution (§5: on_my_way → in_progress (pre-job photos purge) → pending_completion)
  { from: 'on_my_way', action: 'checked_in', actor: 'cleaner', to: 'in_progress', sideEffects: ['purge_prejob_photos'] },
  { from: 'on_my_way', action: 'no_show_reported', actor: 'admin', to: 'cancelled', sideEffects: ['ledger.refund'] },
  { from: 'in_progress', action: 'finished', actor: 'cleaner', to: 'pending_completion', sideEffects: [] },

  // Completion (§5: confirm / 48 h auto → LEDGER RELEASE; dispute → payout FROZEN)
  { from: 'pending_completion', action: 'completion_confirmed', actor: 'customer', to: 'completed', sideEffects: ['ledger.release'] },
  { from: 'pending_completion', action: 'auto_confirmed', actor: 'system', to: 'completed', sideEffects: ['ledger.release'] },
  { from: 'pending_completion', action: 'dispute_opened', actor: 'customer', to: 'disputed', sideEffects: ['payout_freeze'] },

  // Dispute resolution (§5: admin resolves → completed (release/partial) | refunded)
  { from: 'disputed', action: 'dispute_resolved_release', actor: 'admin', to: 'completed', sideEffects: ['ledger.release'] },
  { from: 'disputed', action: 'dispute_resolved_partial', actor: 'admin', to: 'completed', sideEffects: ['ledger.partial'] },
  { from: 'disputed', action: 'dispute_resolved_refund', actor: 'admin', to: 'refunded', sideEffects: ['ledger.refund'] },
] as const;
