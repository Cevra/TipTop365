'use client';

import { useState } from 'react';
import { cn } from '@/lib/ui/cn';

// Star rating — display mode (readonly) or interactive (onChange). Used on
// cleaner cards (display) and the review screen (interactive), plan §11.
export function RatingStars({
  value,
  onChange,
  size = 'md',
  count = 5,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  count?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = typeof onChange === 'function';
  const px = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl';
  const shown = hover ?? value;

  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'} aria-label={`${value} / ${count}`}>
      {Array.from({ length: count }, (_, i) => {
        const filled = i < Math.round(shown);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(i + 1)}
            onMouseEnter={() => interactive && setHover(i + 1)}
            onMouseLeave={() => interactive && setHover(null)}
            aria-label={`${i + 1}`}
            className={cn(px, filled ? 'text-warning' : 'text-gray-300', interactive && 'cursor-pointer')}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
