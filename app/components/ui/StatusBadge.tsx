import { cn } from '@/lib/ui/cn';
import { STATUS_TOKEN, type BookingStatus, type StatusToken } from '@/lib/shared/bookingStatus';

// Booking-status pill. Colors come only from the locked status.* tokens
// (plan §20.3). `label` is passed in already-localized by the caller.
const TOKEN_CLASS: Record<StatusToken, string> = {
  matching: 'bg-status-matching/10 text-status-matching',
  active: 'bg-status-active/10 text-status-active',
  review: 'bg-status-review/10 text-status-review',
  done: 'bg-status-done/10 text-status-done',
  alert: 'bg-status-alert/10 text-status-alert',
  idle: 'bg-status-idle/10 text-status-idle',
};

export function StatusBadge({ status, label }: { status: BookingStatus; label: string }) {
  const token = STATUS_TOKEN[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TOKEN_CLASS_SAFE(token),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

// Indirection keeps Tailwind's content scanner happy with the static map above.
function TOKEN_CLASS_SAFE(token: StatusToken): string {
  return TOKEN_CLASS[token];
}
