// FSM lookup (E3.4, plan §5): (fromStatus, action, actorType) → transition.
// Illegal transitions and wrong actors throw distinct, typed errors so API
// handlers can map them to stable codes (409 vs 403). Pure — no I/O.

import type { BookingStatus, BookingActorType } from '@prisma/client';
import { TRANSITIONS, type BookingAction, type Transition } from './transitions';

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly action: BookingAction,
  ) {
    super(`No transition for action "${action}" from status "${from}"`);
    this.name = 'IllegalTransitionError';
  }
}

export class WrongActorError extends Error {
  constructor(
    public readonly action: BookingAction,
    public readonly expected: BookingActorType,
    public readonly got: BookingActorType,
  ) {
    super(`Action "${action}" requires actor "${expected}", got "${got}"`);
    this.name = 'WrongActorError';
  }
}

/**
 * Resolve a transition or throw. Admin is NOT a wildcard: only edges the §5
 * diagram gives to admin (no-show, dispute resolution) accept it — admin
 * support tooling that needs to force other states goes through E9's dedicated
 * reassign/cancel flows, which call their own edges.
 */
export function transition(
  from: BookingStatus,
  action: BookingAction,
  actor: BookingActorType,
): Transition {
  const byAction = TRANSITIONS.filter((t) => t.from === from && t.action === action);
  if (byAction.length === 0) throw new IllegalTransitionError(from, action);
  const match = byAction.find((t) => t.actor === actor);
  if (!match) throw new WrongActorError(action, byAction[0].actor, actor);
  return match;
}

/** Legal actions for a status+actor — drives which buttons a screen renders. */
export function actionsFor(from: BookingStatus, actor: BookingActorType): BookingAction[] {
  return TRANSITIONS.filter((t) => t.from === from && t.actor === actor).map((t) => t.action);
}

/** Terminal statuses (no outgoing edges). */
export function isTerminal(status: BookingStatus): boolean {
  return !TRANSITIONS.some((t) => t.from === status);
}
