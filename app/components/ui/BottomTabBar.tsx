'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/ui/cn';

export interface TabItem {
  href: string;
  label: string;
  icon: string; // emoji/glyph placeholder; swapped for icon set later
}

// Mobile bottom navigation (plan §11.1). Locale-aware links; hidden on md+.
export function BottomTabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
              active ? 'text-primary-600' : 'text-gray-500',
            )}
          >
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
