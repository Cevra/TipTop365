import { cn } from '@/lib/ui/cn';

// Wizard progress indicator (plan H1 booking wizard). Numbered steps with a
// connector; steps before `current` are complete.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done && 'bg-primary-500 text-white',
                active && 'bg-primary-100 text-primary-700 ring-2 ring-primary-500',
                !done && !active && 'bg-gray-100 text-gray-400',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={cn('hidden truncate text-sm sm:block', active ? 'text-gray-900' : 'text-gray-500')}>
              {label}
            </span>
            {i < steps.length - 1 && <span className={cn('h-0.5 flex-1', done ? 'bg-primary-500' : 'bg-gray-200')} />}
          </li>
        );
      })}
    </ol>
  );
}
