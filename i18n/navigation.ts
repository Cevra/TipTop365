import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware drop-in replacements for next/link + next/navigation. These
// auto-prefix the active locale, so components never hardcode "/bs" or "/en".
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
