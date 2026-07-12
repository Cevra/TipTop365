import { cn } from '@/lib/ui/cn';

export interface TimelineStep {
  key: string;
  label: string;
  at?: string; // localized timestamp, optional
}

// Vertical booking timeline (plan §11.5 / H4). `currentIndex` marks the active
// step; earlier steps are done, later steps pending.
export function StatusTimeline({
  steps,
  currentIndex,
}: {
  steps: TimelineStep[];
  currentIndex: number;
}) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  done && 'bg-primary-500 text-white',
                  active && 'border-2 border-primary-500 text-primary-600',
                  !done && !active && 'border-2 border-gray-300 text-gray-400',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              {!last && (
                <span className={cn('w-0.5 flex-1 min-h-6', done ? 'bg-primary-500' : 'bg-gray-200')} />
              )}
            </div>
            <div className={cn('pb-6', last && 'pb-0')}>
              <p className={cn('text-sm font-medium', active ? 'text-gray-900' : 'text-gray-600')}>
                {step.label}
              </p>
              {step.at && <p className="text-xs text-gray-400">{step.at}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
