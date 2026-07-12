// Booking lifecycle statuses (plan §5). The authoritative FSM transition table
// lands in E3.4 (lib/domain/bookingFsm); this module is just the status set +
// its display mapping, shared by StatusBadge/StatusTimeline and the FSM.

export const BOOKING_STATUSES = [
  'draft',
  'pending_payment',
  'matching',
  'accepted',
  'on_my_way',
  'in_progress',
  'pending_completion',
  'completed',
  'disputed',
  'cancelled',
  'refunded',
  'expired',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Which locked status token (plan §20.3, tailwind `status.*`) renders each phase.
export type StatusToken = 'matching' | 'active' | 'review' | 'done' | 'alert' | 'idle';

export const STATUS_TOKEN: Record<BookingStatus, StatusToken> = {
  draft: 'idle',
  pending_payment: 'matching',
  matching: 'matching',
  accepted: 'active',
  on_my_way: 'active',
  in_progress: 'active',
  pending_completion: 'review',
  completed: 'done',
  disputed: 'alert',
  cancelled: 'alert',
  refunded: 'alert',
  expired: 'idle',
};

/** i18n message key for a status label (messages Booking.status.<status>). */
export function statusLabelKey(status: BookingStatus): string {
  return `Booking.status.${status}`;
}
